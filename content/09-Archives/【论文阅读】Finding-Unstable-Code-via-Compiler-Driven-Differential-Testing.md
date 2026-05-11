---
date: 2023/07/27 15:43:41
title: (论文阅读)★Finding Unstable Code via Compiler-Driven Differential Testing
author: Shaw
categories: Paper
tags: ["Fuzzing"]
---

# Finding Unstable Code via Compiler-Driven Differential Testing

>**时间：**2023
>
>**作者：**Shaohua Li、Zhendong Su（苏黎世联邦理工）
>
>**会议：**ASPLOS（CCF-A）
>
>**开源：**[shao-hua-li/compdiff (github.com)](https://github.com/shao-hua-li/compdiff/)

## Abstract

​	不稳定的代码是指由于程序中存在未定义行为（UB），导致运行时语义不一致或不稳定的代码。编译器通过假设未定义行为永远不会发生来利用UB，从而生成高效但潜在语义不一致的二进制文件。实践者们在设计动态工具（例如sanitizers）来处理常见的UB问题时已付出了大量研究和工程努力。然而，目前的技术仍面临一个重大挑战，即如何检测那些超出当前技术范围的UB问题。

​	在本文中，我们介绍了一种名为Compiler-driven differential testing（CompDiff）的简单而有效的方法，用于发现C/C++程序中的不稳定代码。CompDiff利用了一个事实，即当编译不稳定代码时，不同的编译器实现可能会生成语义上不一致的二进制文件。**我们的主要方法是检查相同输入上不同二进制文件的输出。输出的差异可能表明存在不稳定的代码。为了在实际程序中检测不稳定代码，我们还将CompDiff集成到<u>AFL++</u>中，这是最常用且积极维护的通用模糊测试工具。**

​	尽管CompDiff的方法简单，但实践中非常有效：在Juliet基准程序上，相比于sanitizers，CompDiff独特地检测到1,409个错误；在23个流行的开源C/C++项目中，CompDiff-AFL++发现了78个新错误，其中52个已经被开发人员修复，而36个无法通过sanitizers检测出来。我们的评估还揭示了一个事实，即CompDiff的设计并不是为了取代当前的UB检测工具，而是为它们提供补充。



## Background

​	<u>对于包含未定义行为的代码，不同的编译器实现可能会生成语义不同的二进制文件。</u>**之前的研究 [47, 48] 表明，未定义行为可能会导致优化不稳定代码，即编译器优化可能会意外丢弃的代码。**

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230727163600.png" style="zoom:50%;" />

​		如上图Line9的if语句尝试处理可能出现的整数溢出，该语句（offset+len < offset）只有在整数溢出时才可能成立。但是，编译器可以在假设未定义行为从未发生的情况下进行任意优化操作，结果就是在clang -O2参数下移除了9-11行代码，在-O0下则不会。

​	一方面，这个问题会导致优化后的二进制文件出现安全漏洞，因为大量非法内存数据可能会被转储。另一方面，它破坏了代码的功能正确性，因为由不同编译器编译的二进制文件可能会产生不同的输出结果。

## Contribution

- 我们提出的 **CompDiff** 是一种简单、直接但有效的查找不稳定代码的方法;
- 我们将 CompDiff 集成到AFL++中;
- 我们在基准程序和实际程序上对 CompDiff 进行了评估，结果表明，CompDiff 对sanitizer有明显的补充作用。

## Examples

#### Example 1: Invalid pointer comparison

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230727165335.png" style="zoom:50%;" />

​	上图是CompDiff在Binutils中找到的不稳定代码样例，指针`look_for`和`saved_start`分别指向不同的对象。使用关系运算符对指向不同的对象进行比较是一个未定义行为，并且已有的sanitizer并不能对其进行检测，因为没办法设计一个合理的监测机制。

​	但CompDiff 可以轻松检测到这一问题，因为不同编译器实现对if语句的评估方式不同，因此会观察到不同的输出结果。

#### Example 2: Evaluation order of subexpressions with conflict side effects

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230727165850.png" style="zoom:50%;" />

​	上图是从Tcpdump中找到的不稳定代码样例，第九行通过调用DP_PRINT函数来dump信息，并且该函数的两个参数是函数GET_LINKADDR_STRING的返回值。

​	首先，函数GET_LINKADDR_STRING使用**<u>*静态*</u>**字符数组缓冲区来存储生成的字符串，缓冲区指向的内存区域将在函数调用中共享。<u>由于该函数有两次调用，第一次调用存储在缓冲区中的结果将被第二次调用覆盖。因此，在转储的字符串中，who-is 和 tell 这两个字段总是相同的</u>。

​	其次，由于语言规范对函数参数的评估顺序没有限制，不同的编译器可能会以不同的顺序评估这两次 GET_LINKADDR_STRING 调用。如果我们分别用 gcc 和 clang 编译 Tcpdump，得到的两个二进制文件会以相反的顺序评估 ND_PRINT 的参数，从而导致转储字符串不一致。具体来说，clang 会从第一个到最后一个评估参数，即 p2 会同时转储到 who-is 和 tell；而 gcc 会从最后一个到第一个评估参数，即 p1 会同时转储到两个属性。

​	目前已有的sanitizer没法发现这个问题，要扩展sanitizer以支持此类检测，需要设计一个新的检查器，检查多个子表达式是否会对冲突内存区域产生副作用，但如何实现这样的检查器仍是未知数。

#### Example 3: Uninitialized memory usage

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230727170655.png" style="zoom:50%;" />

​	上图给出了一个由于使用了未初始化变量而导致不稳定的代码片段。开发人员可能会认为，虽然变量` l `未初始化，但其初始随机值应在第 6 行被 `is `中的内容覆盖。<u>然而，在 `is `为空字符串的情况下，变量 `l `将保持不变</u>，然后，未初始化的值将用于剩余的执行过程，在本例中将打印输出到 ostream。

​	虽然MemorySanitizer支持检测未初始化内存的使用，其中未初始化值必须用于确定代码分支，例如，if语句依赖于未初始化值。<u>为避免误报，它不支持示例中所示的情况</u>。但CompDiff-AFL++ 可以检测到这一问题，因为：

​	1）后端 AFL++可以生成导致变量为空的测试样例，从而使不同二进制文件中的 `l `不同；

​	2）CompDiff 可以捕获不同的输出。

## Model

### Workflow of CompDiff

>1. 找到一些自身完善的编译器C~i~；
>2. 用这些编译器编译程序P得到多个二进制文件B~i~；
>3. 找到一个输入集L；
>4. 在每个B~i~上运行L，得到输出O~i~，比较其异同。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230727172424.png" style="zoom:50%;" />

### :star:CompDiff-AFL++

​	在CompDiff结合AFL++的过程中，从一份待测试源码编译了若干个二进制程序，其中一个$B_{fuzz}$是用AFL自带的编译器插桩编译完成的，其就是正常使用AFL++时的工作流程，编译器（如afl-clang-fast）会在二进制程序中插入forkserver、覆盖率反馈以及可选的sanitizer功能。其余的二进制程序都是从待测试编译器中编译而来的普通二进制程序，为了快速运行，我们在其中插入了AFL的forkserver功能。

#### Instrumentation on ℬ𝑖

​	每个Bi由不同的（编译器+优化参数）配置编译而成，并对其进行代码插桩以实现forkserver，forkserver的具体机制见：[(技术积累)How does AFL++ run a program? | Shaw (shawdox.github.io)](https://shawdox.github.io/2023/07/23/[技术积累]How does AFL++ run a program/)

#### Output examination

​	默认情况下AFL++会丢弃待测试程序的输出，这里可以使用dup2()函数将其重定向到指定的文件，然后通过检查输出文件的checksum来判断是否有discrepancy。这里我们使用了AFL++支持的MurmurHash3哈希函数来计算checksum。

#### Bug-triggering inputs

​	我们会将引发输出discrepancy的所有输入保存到一个单独的目录 "diffs/"中，以便将来进行诊断。与普通fuzzing中的崩溃触发输入类似，有许多输入会触发相同的错误，自动识别独特的差异并非易事，尤其是在differential testing的情况下。目前，<u>我们依靠人工分析报告的差异来分流错误报告</u>。

## Evaluation

### 1. 测试环境

- **版本信息：**

  ​	在我们的测试中，使用了`gcc 11.1.0`和`clang 13.0.1`（当时最新的版本）作为测试的后端编译器，在每个编译器中都会测试`-O0`, `-O1`,` -O2`,` -O3`, 和`-Os`优化选项，故一共有10中不同的编译配置选项。AFL++的版本是3.15a。

- **数据集：**

  1. Juliet test suite

  2. 23 个维护良好的开源 C/C++ 项目

     <img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230727210431.png" style="zoom:50%;" />

- **对比：**

  1. 3种广泛使用的静态分析工具：Coverity [40]、Cppcheck [12] 和 Infer [31]；
  2. Sanitizers：ASan、UBSan、MSan；

### 2. 测试结果

​	测试分为两个部分：在Juliet test suite上测试用于测试CompDiff的effectiveness；在真实的项目上测试其检测bug的能力。

#### 2.1 Effectiveness of CompDiff in Benchmark Programs

1. 与 CompDiff 相比，静态工具的false positive不可忽略，并且错误检测率相对较低。
2. CompDiff 可以发现许多额外的错误，是对sanitizer的补充；
3. 与每种sanitizer相比，CompDiff 的bug覆盖率最高;
4. CompDiff 会遗漏某些类型的错误;
5. CompDiff 没有false postive。

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230727205349.png)	

#### 2.2 The bug detection capability of CompDiffAFL++ in real-world software

  	在真实的C/C++项目上使用CompDiff，其直接利用其Unit test作为初始种子进行fuzzing：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230727211612.png)

## 小记

**CompDiff文章的优点：**

1. **数据分析十分详尽**，利用Juliet test suite测试其effectiveness，利用开源项目测试其发现bug的真实能力，并对其发现bug的能力、误报率、与其它工具的对比、不同编译选项的影响都分析的十分到位，图表清晰明了，分析数据详实，很有说服力；
2. idea立意很好，通过examples很好的说明了为什么已有的工具没法解决一些未定义行为，而CompDiff可以，突出了其优点；
3. [待更新]

