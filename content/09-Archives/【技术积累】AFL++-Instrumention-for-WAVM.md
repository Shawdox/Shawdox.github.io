---
date: 2023/08/03 10:47:05
title: (技术积累)AFL++ Instrumention for WAVM
author: Shaw
categories: Paper
tags: ["Fuzzing"]
---

# (技术积累)AFL++ Instrumention for WAVM

​	利用AFL++自带的compiler warpper对WAVM插桩，一些Bug的记录分析。



## Instrumention

```bash
cmake ../ -G "Unix Makefiles" -DCMAKE_C_COMPILER=/home/wx/Shaw/discrepancy_cases_study/compdiff/compilers/diff-cc-1  -DCMAKE_CXX_COMPILER=/home/wx/Shaw/discrepancy_cases_study/compdiff/compilers/diff-cxx-1 -DLLVM_DIR=/home/wx/Shaw/discrepancy_cases_study/compdiff/llvm-project/install/lib/cmake/llvm

```

## Bugs

### 1. AFL++崩溃

​	使用afl-gcc-fast编译WAVM，然后放到修改后的AFL中运行。程序每次都在total exec=14时退出并报错：“segmentation fault”，使用GDB调试发现如下信息：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230803155017.png)

​	问题定位到differential_compilers()函数第一次运行diff forkserver时，其afl_fsrv_run_target()函数中使用的memset()函数：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230803155748.png" alt="in afl_fsrv_run_target()" style="zoom:67%;" />

​	但这里的问题就是，如果本次测试运行指定了参数`-y 0`，也就是不使用diff forkserver，而在differential_compilers()函数中：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230803163027.png" style="zoom: 67%;" />

​	**错误原因：**<u>即使没有设置diff forkserver，这里还是会尝试运行afl->diff_fsrv[0]，所以后续对一块没有分配过的内存进行memset操作就会出错。</u>这里属于是对代码边界条件的判断错误。

​	在differential_compilers()函数内加上条件判断，重新编译即可解决：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230803163223.png" style="zoom: 67%;" />



### 2. AFL++卡死

​	修复完上面的Bug后，使用如下命令测试CompDiff在新版AFL上的功能：

```bash
./afl-fuzz -y 1 -i /home/wx/Shaw/idea_test/libtiff/seed -o /home/wx/Shaw/idea_test/out1 -J "out.file" -- /home/wx/Shaw/idea_test/libtiff/tools/tiffcp -M -i @@ out.file
```

​	发现其每次都在total execs达到200左右时卡住，然后显示如下错误：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230803180929.png" style="zoom:67%;" />

​	GDB调试发现程序在第一次进入differential_compilers()函数就会出错，也就是trim阶段刚结束，正式开始运行时。继续调试，发现在主函数afl-fuzz.c中，afl_fsrv_start_diff()相关代码根本就没有运行：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230804100457.png" style="zoom: 67%;" />

​	当程序运行到afl-fuzz.c的2189行时，查看其条件判断，发现环境变量`AFL_SKIP_BIN_CHECK`被设置为1，导致这里直接跳过了diff forkserver的初始化过程：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230804100250.png" style="zoom: 67%;" />

​	这是由于之前复现WAFL时使用的环境变量`AFL_SKIP_BIN_CHECK`还留存在了同一个bash中，导致了程序直接跳过了部分代码。

​	并且，由于在diff-afl-forkserver.c中的read_s32_timed()函数中，从子进程读取时读出的长度是0：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230804111716.png" style="zoom:67%;" />

​	这是由于这里使用的是原生的afl-gcc-fast编译的程序，其插桩时还是按照198,199的文件描述符与forkserver通信，而在diff forkserver的定义中，其是从202开始的，diff 0应该从202开始与forkserver通信才对：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230804145807.png" style="zoom:67%;" />

​	**错误原因：**

>  		1. 错误使用环境变量`AFL_SKIP_BIN_CHECK`导致diff forkserver根本没有初始化；
>  		2. 没有使用diff as对target插桩，导致fuzz target使用了错误的管道。

​	故这里不要用原生AFL编译器编译的target，直接使用CompDiff提供的编译器编译的二进制文件即可：

```bash
./afl-fuzz -y 1 -i /home/wx/Shaw/discrepancy_cases_study/compdiff/examples/libtiff/seeds -o /home/wx/Shaw/idea_test/out -J "out.file" -- /home/wx/Shaw/idea_test/tiffcp -M -i @@ out.file
```



### 3. 按Ctrl+C后程序结束，但不返回bash

```bash
./afl-fuzz -y 1 -i /home/wx/Shaw/discrepancy_cases_study/compdiff/examples/libtiff/seeds -o /home/wx/Shaw/idea_test/out -J "out.file" -- /home/wx/Shaw/idea_test/tiffcp -M -i @@ out.file


./afl-fuzz -y 1 -i /home/wx/Shaw/idea_test/in -o /home/wx/Shaw/idea_test/out  -- /home/wx/Shaw/idea_test/wavm run /home/wx/Shaw/idea_c_test.wasm 

./afl-fuzz -y 2 -i /home/wx/Shaw/idea_test/in -o /home/wx/Shaw/idea_test/out  -- /home/wx/Shaw/idea_test/test-instr -i @@ -b
```



### 4. Without wasm:检测不到discrepancy

​	使用如下测试程序来测试CompDiff：

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(int argc, char** argv) {
  char buf[8];
  if (read(0, buf, 8) < 1) {
    printf("Hum?\n");
    exit(1);
  }

  if (buf[0] == '0')
    // printf("I'm native one!\n");
    // printf("I'm wasm one!\n");
  else
    printf("A non-zero value? How quaint!\n");
  exit(0);
}
```

​	当buf[0]='0'时，原始程序和待测试程序分别会打印不同的内容，但测试过程中diff目录没有任何记录。

​	**错误原因1：**<u>原生的binary不参与discrenpancy的比较，只负责引导fuzzing。</u>

​	查看differential_compilers()代码（[DiffComp比较-核心逻辑](https://shawdox.github.io/2023/07/31/%E3%80%90%E8%AE%BA%E6%96%87%E5%A4%8D%E7%8E%B0%E3%80%91CompDiff(%E4%BA%8C)-%E4%BB%A3%E7%A0%81%E5%88%86%E6%9E%90/#stardiffcomp%E6%AF%94%E8%BE%83-%E6%A0%B8%E5%BF%83%E9%80%BB%E8%BE%91)）可知，CompDiff先运行一次diff_forkserver 0,然后依次运行后续的diff forkserver，每运行一个就与最开始运行的diff_forkserver 0的结果比较，如果有不同就记录discrepancy。

​	故这里不能指定`-y`为1，不然只有一个diff forkserver没有办法比较，正确做法是指定2个，然后用上述的compiler warpper包装它。

```bash
./afl-fuzz -y 2 -i /home/wx/Shaw/idea_test/in -o /home/wx/Shaw/idea_test/out  -- /home/wx/Shaw/idea_test/test-instr
```

​	这样就可以成功检测到discrepancy:

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230805094454.png" style="zoom:67%;" />

### 5. With wasm:检测不到discrepancy

​	在修正上述问题后，将diff forkserver 0设置为native binary，将diff forkserver 1设置为wasm binary，并修改forkserver的out_file参数和target（将target变为wavm），程序可以成功运行，但是检测不到discrepancy。

```bash
./afl-fuzz -i /home/wx/Shaw/idea_test/in -o /home/wx/Shaw/idea_test/out  -- /home/wx/Shaw/idea_test/test-instr
```

​	而且注意到在测试的过程中 ，`.cur_output0`文件（native binary输出文件）一直有输出，但`.cur_output1`（wasm binary输出文件）一直是空的：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230805153613.png" style="zoom:67%;" />

​	**问题原因：**<u>wavm运行时间太长，导致程序运行diff forkserver 1时直接退出了。</u>

​	这里将diff forkserver 1的运行时间延长10倍（也就是跟forkserver初始化的时间相同），即可解决：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230805160555.png" alt="From differential_compilers()" style="zoom:67%;" />

### 6. `last new find`总是等于`run time`

​	在测试过程中，发现输出的`last new find`总是等于`run time`，这就意味着每时每刻都在发现新cov：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230805092002.png" style="zoom:67%;" />

