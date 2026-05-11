---
date: 2023/05/01 14:40:01
title: (LLVM入门)编写LLVM PASS
author: Shaw
categories: Code
tags: ["LLVM"]
---

# (LLVM入门)编写LLVM PASS

​	前置知识：

>1. LLVM IR结构；
>2. C++ 面向对象；
>3. CMake；



## 一、理论

#### LLVM IR

1. LLVM IR 文件的基本单位称为 `module`，LLVM中的Module，代表了一块代码。它是一个比较完整独立的代码块，是一个最小的编译单元。；
2. 一个 `module` 中可以拥有多个顶层实体，比如 `function` 和 `global variavle`；
3. 一个 `function define` 中至少有一个 `basicblock`；
4. 每个 `basicblock` 中有若干 `instruction`，并且都以 `terminator instruction` 结尾。

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20230420162739440.png)

(详见：[PowerPoint Presentation (llvm.org)](https://llvm.org/devmtg/2019-04/slides/Tutorial-Bridgers-LLVM_IR_tutorial.pdf))

#### What is a PASS?

1. pass 对LLVM IR的一些单元进行操作，例如module或者function；
2. pass有两类，Analysis pass和Transformation pass。Transformation pass会对单元进行修改操作，Analysis pass不修改，只观察并生成一些高层信息；



​	Pass Manager：调度Pass在各IR层级按顺序运行。 （什么是各IR层级？）

#### opt

​	opt是LLVM的代码优化器，其输入ll源文件，其可以对源文件进行优化（输出优化后的ll源文件）或者分析（输出分析结果）。



<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20230429225221269.png" alt="opt workflow" style="zoom:80%;" />

​	在使用opt命令时，-{passname}提供了以任何顺序运行任何LLVM优化或分析Pass的能力。

## 二、代码实践

常见llvm编译命令：

```bash
#.c -> .ll：
clang -emit-llvm -S a.c -o a.ll
#.c -> .bc: 
clang -emit-llvm -c a.c -o a.bc
#.ll -> .bc: 
llvm-as a.ll -o a.bc
#.bc -> .ll: 
llvm-dis a.bc -o a.ll
#.bc -> .s: 
lc a.bc -o a.s
```

### 2. Hellow World PASS

>目标：打印出编译程序中存在的非外部函数的名称，该 Pass 只是检查程序，不修改原程序。

​	llvm安装编译过程略，详见github官方项目。

#### 2.1 old manager

​	**<u>旧版pass manager采用继承对应PASS类，覆写父类虚函数的方式定义用户自己的pass类</u>**，编写old_hello.cpp如下：

```cpp
//old_Hello.cpp
#include "llvm/Pass.h"
#include "llvm/IR/Function.h"
#include "llvm/Support/raw_ostream.h"

using namespace llvm;

//使用匿名命名空间，使得其中定义的函数对其它文件不可见；
//防止命名空间污染
namespace{
    //FunctionPass每次操作一个函数,Hellp继承它
    struct Hello:public FunctionPass{
        static char ID;
        Hello() : FunctionPass(ID){}
        //覆写父类的虚函数，override是覆写标志，使用它时当没有正确
        //进行覆写操作时编译器会报error而不是warnning，且子类覆写
        //的虚函数也不用再加virtual关键字；
        //如果要禁止子类覆写虚函数，可以使用final关键字。
        bool runOnFunction(Function &F) override {
            //打印"Hello: 函数名称"
            errs() << "Hello: ";
            errs().write_escaped(F.getName()) << '\n';
            return false;
        }
    };
}
//初始化ID
char Hello::ID = 0;
//Register for opt
static RegisterPass<Hello> X("hello","Hello World Pass",
                            false/* Only looks at CFG */,
                            false/* Only looks at CFG */);
                        
```

​	编写一个待测试文件test.cpp：

```cpp
#include<stdio.h>
void fun1(){
    printf("111\n");
}
void fun2(){
    printf("222\n");
}
void fun3(){
    printf("333\n");
}
int main(void){
    printf("%d\n",fun1());
    printf("%d\n",fun2());
    //printf("%d\n",fun3());
    return 0;
}
```

​	编译pass和test文件：

```bash
#编译pass，也可以自行定义CMakeLists文件，手动编译;
#llvm-config提供了CXXFLAGS与LDFLAGS参数方便查找LLVM的头文件与库文件;
#如果链接有问题，还可以用llvm-config --libs提供动态链接的LLVM库;
#具体llvm-config打印了什么，请自行尝试或查找官方文档;
#-fPIC -shared 是编译动态库的必要参数。
#因为LLVM没用到RTTI，所以用-fno-rtti 来让我们的Pass与之一致;
#-Wl,-znodelete是为了应对LLVM 5.0+中加载ModulePass引起segmentation fault的bug;
#若Pass继承了ModulePass，务必加上。
clang `llvm-config --cxxflags` -Wl,-znodelete -fno-rtti -fPIC -shared old_hello.cpp -o LLVMHello.so `llvm-config --ldflags`
#将待测试文件编译为bitcode
clang -emit-llvm -c test.cpp -o test.bc
```

​	使用opt命令加载运行，运行结果：

```bash
#-loda 选项表明要加载进程序的pass
#-hello 是注册时规定的参数
#由于此pass并不修改程序，故将opt的输出结果放入/dev/null(丢弃)
sudo opt -load ./LLVMHello.so -hello < test.bc > /dev/null

Hello: _Z4fun1v
Hello: _Z4fun2v
Hello: _Z4fun3v
Hello: main
```

​	在命令中加入-time-passes参数，可以获得运行时间相关结果：

```bash
$sudo opt -load ./LLVMHello.so -hello -time-passes < test.bc > /dev/null
Hello: _Z4fun1v
Hello: _Z4fun2v
Hello: _Z4fun3v
Hello: main
==-------------------------------------------------------------------------==
                      ... Pass execution timing report ...
==-------------------------------------------------------------------------==
  Total Execution Time: 0.0006 seconds (0.0006 wall clock)

---User Time---   --System Time--   --User+System--  ---Wall Time---  ---Name ---
   0.0001 ( 61.1%)   0.0002 ( 62.0%)   0.0003 ( 61.7%)   0.0003 ( 62.0%)  Bitcode Writer
   0.0001 ( 33.7%)   0.0001 ( 33.2%)   0.0002 ( 33.3%)   0.0002 ( 33.0%)  Hello World Pass
   0.0000 (  5.3%)   0.0000 (  4.8%)   0.0000 (  5.0%)   0.0000 (  5.0%)  Module Verifier
   0.0002 (100.0%)   0.0004 (100.0%)   0.0006 (100.0%)   0.0006 (100.0%)  Total
==-------------------------------------------------------------------------==
                                LLVM IR Parsing
===-------------------------------------------------------------------------==
  Total Execution Time: 0.0005 seconds (0.0005 wall clock)

   ---User Time---   --System Time--   --User+System--   ---Wall Time---  --- Name ---
   0.0002 (100.0%)   0.0003 (100.0%)   0.0005 (100.0%)   0.0005 (100.0%)  Parse IR
   0.0002 (100.0%)   0.0003 (100.0%)   0.0005 (100.0%)   0.0005 (100.0%)  Total
```

​	如果想直接使用clang集成这个过程，需要在pass注册时添加：

```cpp
#include "llvm/IR/LegacyPassManager.h"
#include "llvm/Transforms/IPO/PassManagerBuilder.h"

// Register for clang
static RegisterStandardPasses Y(PassManagerBuilder::EP_EarlyAsPossible,
  [](const PassManagerBuilder &Builder, legacy::PassManagerBase &PM) {
    PM.add(new Hello());
  });
```

​	接下来无需提前编译bc文件再调用opt，直接使用clang即可：

```bash
clang -Xclang -load -Xclang ./LLVMHello.so test.cpp -o clang_test

Hello: _Z4fun1v
Hello: _Z4fun2v
Hello: _Z4fun3v
Hello: main
```

#### 2.2 new manager

​	llvm新版本的pass manager定义依赖于多态，意味着并不存在显示的接口，所有的 Pass 是继承自 CRTP 模板`PassInfoMixin<PassT>`，其中需要有一个`run()`方法，接收一些 IR 单元和一个分析管理器，返回类型为 PreservedAnalyses。

```c++
//new_hellp.cpp
#include "llvm/IR/LegacyPassManager.h"
#include "llvm/Passes/PassBuilder.h"
#include "llvm/Passes/PassPlugin.h"
#include "llvm/Support/raw_ostream.h"

using namespace llvm;

namespace{
    void visitor(Function &F){
        errs() << "(New Hello)FunctionName: " << F.getName() << "\n";
        errs() << "(New Hello)ArgSize: " << F.arg_size() << "\n";
    }

    struct HelloWorld:PassInfoMixin<HelloWorld>{
        PreservedAnalyses run(Function &F,FunctionAnalysisManager &){
            visitor(F);
            return PreservedAnalyses::all();
        }
        static bool isRequired(){return true;}
    };
}//namespace

llvm::PassPluginLibraryInfo getHelloWorldPluginInfo(){
    return{
        LLVM_PLUGIN_API_VERSION,"HelloWorld",LLVM_VERSION_STRING,
        [](PassBuilder &PB){
            PB.registerPipelineParsingCallback(
                [](StringRef Name, FunctionPassManager &FPM,
                ArrayRef<PassBuilder::PipelineElement>){
                    if(Name == "hello-world"){
                        FPM.addPass(HelloWorld());
                        return true;
                    }
                    return true;
                });
        }
    };
}

extern "C" LLVM_ATTRIBUTE_WEAK ::llvm::PassPluginLibraryInfo
llvmGetPassPluginInfo(){
    return getHelloWorldPluginInfo();
}
```

​	以上代码分为两部分，Pass本体和Pass注册，具体含义和对应的CMakeLists.txt可参照[llvm-tutor](https://github.com/banach-space/llvm-tutor)，这里不做赘述。尝试运行：

```bash
#编译Pass
export LLVM_DIR=/usr/local/include/llvm/
cmake -DLT_LLVM_INSTALL_DIR=$LLVM_DIR ../
make

#编译输入文件
clang -O1 -S -emit-llvm ../../data/test.cpp -o ../../data/test.ll

#使用new manager加载pass
opt -load-pass-plugin ./libHelloWorld.so -passes=hello-world -disable-output ../../data/test.ll
```

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230501140915.png" style="zoom: 67%;" />





## Reference

- [LLVM IR 的第二个 Pass：上手官方文档 New Pass Manager HelloWorld Pass - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/416754155)
- [LLVM中的pass及其管理机制 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/290946850#:~:text=因此，LLVM pass管理机制的主要模块包括pass、pass管理器、pass注册及相关模块，如PassRegistry、AnalysisUsage、AnalysisResolver等。. 1、LLVM Pass及常用子类.,pass是一种编译器开发的结构化技术，用于完成编译对象（如IR）的转换、分析或优化等功能。. pass的执行就是编译器对编译对象进行转换、分析和优化的过程，pass构建了这些过程所需要的分析结果。. LLVM Pass是LLVM系统的重要组成部分，定义在llvmincludellvmPass.h中：.)
- [Using the New Pass Manager — LLVM 17.0.0git documentation](https://llvm.org/docs/NewPassManager.html)
- [2019 LLVM Developers’ Meeting: A. Warzynski “Writing an LLVM Pass: 101” - YouTube](https://www.youtube.com/watch?v=ar7cJl2aBuU)
- [banach-space/llvm-tutor: A collection of out-of-tree LLVM passes for teaching and learning (github.com)](https://github.com/banach-space/llvm-tutor)

