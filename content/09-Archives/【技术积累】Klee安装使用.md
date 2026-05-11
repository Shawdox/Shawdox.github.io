---
date: 2023/05/30 17:09:53
title: (技术积累)Klee安装使用
author: Shaw
categories: Project
tags: ["Klee","Symbolic Execution"]
---

# Klee安装使用

>Linux系统下著名符号执行工具Klee的安装使用


## Prerequisites

1. 删除旧版本（非官方发行版的Docker）

```bash
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do sudo apt-get remove $pkg; done
```

2. 设置GPG key和仓库，确保下载源

```bash
#Update the apt package index and install packages to allow apt to use a repository over HTTPS:
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg

#Add Docker’s official GPG key:
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

#Set up the repository:
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

3. 安装Docker：

```bash
#install
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
#test
sudo docker run hello-world
```



## Install

​	这里使用现成的Docker环境，直接pull即可：

```bash
 sudo docker pull klee/klee
```

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230530145106.png" style="zoom:50%;" />

​	运行：

```bash
docker run --rm -ti --ulimit='stack=-1:-1' klee/klee
```

​	其中，`--rm`表明容器停止，即使用命令`docker stop`后直接删除容器；`-ti`表明为容器重新分配一个伪输入终端（-t）并且以交互模式运行容器(-i)；`--ulimit`表明将栈设置为无限大。

​	进入容器后检查Klee：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230530150453.png" style="zoom: 67%;" />



## Klee

### 1. Small Function

>测试一个简单函数get_sign()

​	以`get_sign`函数为例：

```c
//First KLEE tutorial: testing a small function

#include "klee/klee.h"

int get_sign(int x) {
  if (x == 0)
     return 0;
  if (x < 0)
     return -1;
  else 
     return 1;
} 

int main() {
  int a;
  klee_make_symbolic(&a, sizeof(a), "a");
  return get_sign(a);
} 
```

​	首先将其编译为bc文件：

```bash
clang -I ../../include -emit-llvm -c -g -O0 -Xclang -disable-O0-optnone get_sign.c
```

​	其中，`-I+<dir>`表明添加搜索路径，用于引入头文件klee/klee.h；`-c`表明只进行预处理、编译和汇编；`-Xclang+<arg>`用于给clang编译器传递参数，这里禁止了优化。

​	运行klee：

```bash
klee get_sign.bc
```

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230530154204.png" style="zoom: 67%;" />

​	由上图可见klee探索了程序中的3条路径并生成了3个测试样例，并生成了两个目录：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230530154657.png" style="zoom: 67%;" />

​	其中`klee-out-0`是输出结果目录，`klee-last`是其符号链接，每次都链接到最新的测试输出中，其包含：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230530154911.png" style="zoom:67%;" />

​	klee生成的测试样例都以`.ktest`结尾，借助`ktest-tool`工具来查看：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230530155115.png" style="zoom:67%;" />

​	使用libkleeRuntest工具手动复现测试样例：

```bash
export LD_LIBRARY_PATH=path-to-klee-build-dir/lib/:$LD_LIBRARY_PATH
gcc -I ../../include -L path-to-klee-build-dir/lib/ get_sign.c -lkleeRuntest
KTEST_FILE=klee-last/test000001.ktest ./a.out
echo $?
```

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230530155831.png" style="zoom:67%;" />

​	如图所示，最后一个测试样例返回255（-1）的原因是-1转换为0-255范围内的有效退出代码值。

​	可见，klee通过对C代码插装，并接受bc输入的方式进行符号执行测试。

### 2. Test GNU coreutils

#### 2.1 安装coreutils & WLLVM

​	下载GNU coreutils源码，这里选用6.11版本（可以用其他版本）：

```bash
#下载
wget https://ftp.gnu.org/gnu/coreutils/coreutils-6.11.tar.gz
#解压
tar -zxvf coreutils-6.11.tar.gz 
```

​	配置并编译coreutils：

```bash
#如果该版本的coreutils有Bug,就使用如下补丁
wget http://web.cs.ucla.edu/classes/winter16/cs35L/assign/coreutils.diff
patch -p0 < coreutils.diff
#编译
mkdir obj-gcov
cd obj-gcov
../configure --disable-nls CFLAGS="-g -fprofile-arcs -ftest-coverage"
make
```

​	编译好的文件位于coreutils/src目录下。通过编译加上`CFLAGS="-g -fprofile-arcs -ftest-coverage"`配置选项，使其支持gcov，每次你运行它时其就会生成一个.gcda文件表明其运行覆盖率如何，例如：

```bash
rm -f *.gcda # Get rid of any stale gcov files
./echo**

ls -l echo.gcda
:'
-rw-rw-r-- 1 klee klee 896 Nov 21 22:00 echo.gcda
'
gcov echo
:'
File '../../src/echo.c'
Lines executed:24.27% of 103
Creating 'echo.c.gcov'

File '../../src/system.h'
Lines executed:0.00% of 3
Creating 'system.h.gcov'
'
```

​	安装WLLVM：

```bash
pip3 install --upgrade wllvm
export LLVM_COMPILER=clang
```

​	使用WLLVM编译coreutils：

```bash
mkdir obj-llvm
cd obj-llvm
CC=wllvm ../configure --disable-nls CFLAGS="-g -O1 -Xclang -disable-llvm-passes -D__NO_STRING_INLINES  -D_FORTIFY_SOURCE=0 -U__OPTIMIZE__"
make
```

​	这里：

- `-fprofile-arcs -ftest-coverage`表明使用gcov对即将用klee测试的文件插桩，这里舍弃了这个flag；
- `-O1 -Xclang -disable-llvm-passes`表明不使用优化，由于LLVM5.0以上版本的O0优化会影响Klee本身的优化措施，故这里使用O1优化并禁止所有LLVM Pass运行；
- `D__NO_STRING_INLINES`表明不使用内联字符串；`-D_FORTIFY_SOURCE=0`表明不使用fortify安全技术，<u>因为其可能会替换现有的函数（fprintf -> __fprintf_chk）导致Klee无法对其建模而将其视为外部函数</u>；`-U__OPTIMIZE__`取消 `__OPTIMIZE__` 的宏定义，禁用编译器所有优化。

​	可以通过`extract-bc`命令从生成的可执行文件中提取bitcode：

```bash
find . -executable -type f | xargs -I '{}' extract-bc '{}'
```

#### 2.2 使用Klee测试文件

​	接下来就可以使用klee运行bc文件：

```bash
klee --libc=uclibc --posix-runtime ./cat.bc --version
```

- `--libc=uclibc`指定了Klee外部函数库，其中定义了程序可能调用的外部函数；
- `--posix-runtime`指定 KLEE 使用 POSIX 标准库作为程序的运行时环境；
- `--version`是传递给cat命令的参数。

​    当Klee指定了uclibc和POSIX，它就会替换程序的main()函数为库中的klee_init_env()函数，这个函数用于支持符号参数的构建。

![运行结果](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230601145325.png)

​	分析以上WARNING：

- `*undefined reference to function: ___ctype_b_loc*`表明`__ctype_b_loc`函数未定义；
- `*executable has module level assembly (ignoring)*`表明一些被编译进应用程序的文件有内嵌汇编语句，Klee无法分析，故跳过（来自uClibc，这里安全）；
- `*calling external: getpagesize()*`表明调用的函数未定义。在这种情况下，Klee尝试调用该函数的本地版本，如果它存在的话。这有时是安全的，只要该函数不写入任何程序内存或试图处理符号值。例如，getpagesize()只是返回一个常数。

​    下面尝试用符号化输入测试echo：

```bash
klee --optimize --libc=uclibc --posix-runtime ./echo.bc --sym-arg 3
```

​	使用如下命令查看统计结果：

```bash
klee-stats klee-last
------------------------------------------------------------------------
|  Path   |  Instrs|  Time(s)|  ICov(%)|  BCov(%)|  ICount|  TSolver(%)|
------------------------------------------------------------------------
|klee-last|   64546|     0.15|    22.07|    14.14|   19943|       62.97|
------------------------------------------------------------------------
```

​	其中：

- **ICov**为LLVM指令覆盖率；
- **BCov**为分支覆盖率；

​    可以看到覆盖率并不高，其中一个原因是由于这些数字是用比特码文件中的所有指令或分支来计算的，包括很多可能是不可执行的库代码。故对于这种情况使用–optimize优化去除死代码会更好：

```bash
klee --optimize --libc=uclibc --posix-runtime ./echo.bc --sym-arg 3
klee-stats klee-last
------------------------------------------------------------------------
|  Path   |  Instrs|  Time(s)|  ICov(%)|  BCov(%)|  ICount|  TSolver(%)|
------------------------------------------------------------------------
|klee-last|   33991|     0.13|    30.16|    21.91|    8339|       80.66|
------------------------------------------------------------------------
```

​	可以看到各项覆盖率都高了一些，klee执行的更快，执行的代码指令更少。



#### 2.3 可视化klee进程

​	`KCachegrind`是一个优秀的可视化工具，可以直接用apt安装。

​	<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230601162143.png" style="zoom:67%;" />

>PS:
>
>​	Kcachegrind是一个图形化工具，如果是通过windows使用ssh服务连接Linux系统，则需要在windows端安装X11服务并在Linux端修改ssh配置使其可以允许X11服务。
>
>相关参考：[X11 forwarding，Windows与Linux结合的最佳开发环境【编程环境优化篇】 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/66075449)

#### 2.4 结果分析

​	可以通过`ktest-tool`工具查看每个单独的测试样例：

```bash
$ ktest-tool klee-last/test000001.ktest
ktest file : 'klee-last/test000001.ktest'
args       : ['./echo.bc', '--sym-arg', '3']
num objects: 2
object    0: name: 'arg0'
object    0: size: 4
object    0: data: '\x00\x00\x00\x00'
object    1: name: 'model_version'
object    1: size: 4
object    1: data: '\x01\x00\x00\x00'
```

​	可以使用`ktest-reply`工具来复现：

```bash
klee-replay ./echo ../../obj-llvm/src/klee-last/*.ktest
```

### 3. Binary

​	

## Reference

- Install:
  - [Prerequisites | Docker Documentation](https://docs.docker.com/engine/install/ubuntu/#prerequisites)
  - [Install Docker Engine on Ubuntu | Docker Documentation](https://docs.docker.com/engine/install/ubuntu/)
  - [Docker · KLEE](http://klee.github.io/docker/)
  - [docker run 参数详解_-CSDN博客](https://blog.csdn.net/weixin_39998006/article/details/99680522)
  - [travitch/whole-program-llvm: A wrapper script to build whole-program LLVM bitcode files (github.com)](https://github.com/travitch/whole-program-llvm)
- Tutorial:
  - [Files · KLEE](http://klee.github.io/docs/files/)
  - [Tutorials · KLEE](http://klee.github.io/tutorials/)
  - [Testing Coreutils · KLEE](http://klee.github.io/tutorials/testing-coreutils/)

