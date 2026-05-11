---
date: 2023/07/28 21:25:50
title: (论文复现)CompDiff(一) 实验复现
author: Shaw
categories: Paper
tags: ["Fuzzing"]
---

# (论文复现)Finding Unstable Code via Compiler-Driven Differential Testing

​	对论文《Finding Unstable Code via Compiler-Driven Differential Testing》的过程复现+代码分析。



## 代码结构

​	CompDiff的代码结构如下：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731152702.png" style="zoom: 50%;" />

​	其中，`aflpp`是以AFL++ 3.15a为基础魔改的版本，`compilers`用于生成包装后的编译器，`examples`包含了作者提供的两个待测试程序和其对应构建脚本。



## 实验复现

### 1. 生成包装编译器

​	从仓库下载代码，运行`./diff-build.sh`脚本：

```bash
#!/bin/bash
set -e

#run ./diff-build.sh clean
if [ "$1" = "clean" ]; then
    cd "./aflpp"
    CC=clang make clean
    cd ../compilers
    make clean
    exit 0
fi
#build modified AFL++ 3.15a
cd "./aflpp"
CC=clang make source-only
CC=clang make -C utils/aflpp_driver
cd ..
#build different compilers(10 by default)
cd "./compilers"
source build.sh
cd ..
```

​	该脚本会编译魔改版的AFL和`compilers`，`compilers`利用了AFL++提供的编译器包装器（warpper）生成不同配置的包装后的编译器：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230728215257.png" style="zoom: 67%;" />

​	对于CC和CXX，各有10个生成，其分别对应用gcc和clang使用`-O0`, `-O1`,`-O2`,`-O3`, 和`-Os`5种优化选项，2×5 = 10。具体逻辑可见/compdiff/compilers/`build.sh`：

```bash
#!/bin/bash
# This is the building script for different compiler configurations.

make clean

if [ "$1" = "clean" ]; then
    exit 0
fi

forksrv=202
id=0

compiler_id=0
for _ in $(seq 1 `jq "[.][0] | length" config`); do
    for config in `jq "[[.][0][${compiler_id}].configs][0][]" config`; do
        export DIFF_CC=`jq "[.][0][${compiler_id}].CC" config`
        export DIFF_CXX=`jq "[.][0][${compiler_id}].CXX" config`
        export DIFF_ID=${id}
        printf "#define FORKSRV_FD ${forksrv} \n #define DIFF_ID ${DIFF_ID} \n #define DIFF_CC ${DIFF_CC} \n #define DIFF_CXX ${DIFF_CXX} \n #define DIFF_CONFIG ${config} " > ./compiler-base/diff-config.h
        make
        id=$((id+1))
        forksrv=$((forksrv+4))
    done
    compiler_id=$((compiler_id+1))
done
```

​	其中，`FORKSRV_FD`是对应在AFL中打开的forkserver中使用的文件描述符；`DIFF_CONFIG`就是对应的优化选项，例如-O1、-O2等；`DIFF_ID`用于区分不同的编译配置（编译器+优化选项），其序号在/compdiff/compilers/config中对应如下：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230728221003.png" style="zoom:50%;" />

​	在for循环中从config获取这些编译选项参数后，通过printf函数将对应设置写入到./compiler-base/diff-config.h文件中，该文件会被同文件夹下的config.h文件包含，并最终被diff-cc.c包装器引用，最终生成我们所需的10种编译器。

​	在后续的过程中，这10中不同的编译器将会用来编译待测试项目/文件。

### 2. 编译项目

​	这里以libtiff为例，用作者已经给出的编译脚本编译（后续可以写自己的）：

```bash
./diff-instrument.sh ./examples/libtiff/build.sh
```

​	可以看到脚本自动下载了libtiff并编译，然后用上一步生成的编译器编译了10个不同的版本和一个原生版本：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230729143953.png" style="zoom: 67%;" />

> PS:由于作者给出的shell脚本都是直接从github仓库下载最新版的软件，最新版本的xpdf样例(2023.7.29)在我的虚拟机上存在QTso库不兼容问题，但这个bug不重要，故避免浪费时间见这里使用libtiff做演示。

### 3. Fuzzing

​	直接运行魔改后的AFL即可：

```bash
$ ./aflpp/afl-fuzz -y 10 -i examples/libtiff/seeds -o examples/libtiff/findings -Y "out.file" -- ./examples/libtiff/bin/tiffcp -M -i @@ out.file
```

​	但其由于需要将程序结果输出到文件中，大量的I/O操作以及每轮需要运行10+1个forkserver，导致其速度还不如正常的1/10：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230729145245.png" style="zoom:50%;" />

​	当然，这是在虚拟机内跑的结果，实际物理机会略快一些，但不会快太多。

​	


​	