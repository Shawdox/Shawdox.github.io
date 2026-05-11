---
date: 2023/05/08 21:21:58
title: (论文阅读)The Use of Likely Invariants as Feedback for FuzzersVulnerabilities
author: Shaw
categories: Paper
tags: ["Fuzzing"]
---

## (论文阅读)The Use of Likely Invariants as Feedback for Fuzzers

>**时间：**2021.8
>
>**作者：**Andrea Fioraldi、Daniele Cono D’Elia、Davide Balzarotti
>
>**会议：**USENIX
>
>**开源：**[eurecom-s3/invscov: The Use of Likely Invariants as Feedback for Fuzzers (github.com)](https://github.com/eurecom-s3/invscov)
>
>截止2023.5.6被引23次

## ABSTRACT

​	如今Fuzzing的主要限制是以coverage-guided为基准设计的fuzzing方法是为了尽可能达到程序的不同部分而逐渐被优化，但若仅仅可达性不足以触发一个漏洞时，这种方法就会陷入困境。<u>实际上，许多bug的触发不仅依赖于特定的控制流，还依赖一些程序的变量的值（数据流）。</u>不幸的是，过去提出的捕捉程序状态的替代探索策略在实践中帮助不大，因为它们会立即导致状态爆炸问题。

​	在本文，我们提出了**一个新型反馈机制，通过考虑到程序变量的”不变值“和其之间的关系来增强代码覆盖率**。为此，我们在基本块层面上学习可能的变量“不变值”，并相应地划分程序状态空间。我们的反馈可以区分输入是否违反了一个或多个不变量，并对其进行奖励，从而完善代码覆盖通常提供的程序状态近似值。

​	基于<u>LLVM和AFPL++</u>，我们在一个名为**INVSCOV**的原型中实现了上述的技术。实验表明，与使用纯代码覆盖反馈的fuzzer相比，我们的方法可以发现更多、更不同的bug。此外，还发现了一个在OSS-Fuzz上每天测试的库中的两个漏洞，而且当时在其最新版本中仍然存在。



## 问题背景

>***“code coverage alone is a necessary but not sufficient condition to discover bugs”***
>
>**代码覆盖率是发现bug的必要条件，不是充分条件。**

#### 1. bug被触发的条件	

​	一个bug被触发应满足两个条件：

	1. 程序运行到特定的指令；
	2. 程序满足确定的条件。

​    少数情况下，程序不需要满足特定的条件也能触发bug，如LAVA-M数据集中的bug，其被人为的制造为只要运行到了特定的点就能触发。

#### 2. coverage-based fuzzing的缺点

​	对于现有的coverage-based的fuzzing方法，fuzzer没有任何动力去探索更多的状态，因为其已经观察到了那里。因此，对于现有的工具来说，检测涉及到对程序状态的复杂约束的bug是相当困难的。如果简单对fuzzer探索更多的状态空间的行为作出奖励，其也会导致**<u>路径爆炸问题</u>**，因为对于非离散的应用，其状态空间基本是无限多的。

#### 3. 例子

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230508201406.png" style="zoom: 67%;" />

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230508201539.png" style="zoom:67%;" />

​	如图所示的漏洞是libsndfile的WAV文件格式解析中的堆溢出漏洞（`Listing2`第9行），libsndfile是一个用于操作音频文件的流行库。在`Listing2`第9行，代码引用了pms->samples所指向的C99变长数组（<u>C99规定数组长度可以为变量</u>）。当`Listing1`中的pmssize（`Listing1`第8行）较小，且pms->blocksize值（`Listing1`第13行）足够高时，写入操作会到达数组边界之外，造成堆溢出。

​	**Coverage-based fuzzer很容易到达该错误的问题点，但是很难触发。由于其并不会提供更多的代码覆盖率，fuzzer不会为这个点分配更多的energy。**



## 创新点

​	在本文中，我们提出了一种新的模糊测试反馈，在考虑代码覆盖率的同时，也考虑到了程序状态中一些有趣的部分，以一种完全自动化的方式进行测试，并且不会引起状态爆炸。**这项工作的创新点并不是“考虑代码覆盖率以外的东西”，这部分已经有人做过，但其问题是：**

 1. **路径爆炸：**	

    一些fuzzer通过使用更敏感的反馈来模拟程序状态，例如引入堆栈信息，甚至引用从内存加载和存储的值。《Be sensitive and collaborative: Analyzing impact of coverage metrics in greybox fuzzing》一文中就不仅考虑了控制流，还考虑了程序状态中的值。但其缺点就是会导致路径爆炸问题。

 2. **需要人工标注：**

    一些工作会使用人工辅助的方式进行，例如FUZZFACTORY让其开发者定义特定的目标，然后添加导航点，当生成的测试样例朝着这些目标前进（<u>例如，当两个比较操作数中有更多位相同时</u>），奖励Fuzzer。

​	故此项工作的创新点是：**<u>“考虑代码覆盖率以外的东西”，并将其过程自动化，且不会引入路径爆炸问题。</u>**



## 方法

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230508211728.png" style="zoom:67%;" />

### 1. Program State Partitions-程序状态分区

​	以上图`Listing1`与`Listing2`为例，用标准的CGF系统对libsndfile进行一定时间的fuzzing（如24h），然后调查fuzzer保存的所有种子，分析这些种子中所有变量，为`Listing1`中的初始函数确定两个不变量，为`Listing2`中的循环确定一个不变量（上图绿色注释）。根据这些注释，将程序的状态空间分为四部分，如下图所示：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230508204234.png" style="zoom: 67%;" />

​	除了状态A，其余状态Fuzzer都没有访问过，通过如此抽象方法来向Fuzzer提供反馈，使其探索新的状态而又不会导致路径爆炸。

​	不变量能够在不引起状态爆炸的情况下划分程序状态空间，这也是方法的关键之一。在每个基本块中，N个不变量可以对状态进行局部划分，就像N条不平行的线可以将一个平面划分为**N∗(N+1)/2+1**个区域一样。在实践中，由于每个基本块通常只操纵几个变量，N通常是一个非常低的值（附录A中的统计数据）。

### 2. Using Invariants as Feedback-使用“不变量”反馈

​	动态“不变量”检测的常见限制是，所产生的“不变量”往往更多的是捕获测试套件的局部属性而不是程序的静态属性。然而这正是我们想要的，违反仅从Fuzzer语料库中学习到的可能的“不变量”可以提示Fuzzer哪些程序状态组合是不寻常的，进而定位错误的根源。

​	这里，使用“不变量”对Fuzzer进行反馈指的是**edge-coverage**与**哪些“不变量”被违反的信息**的组合。我们调整了大多数Coverage-based系统采用的新颖性算法，为每个被违反的“不变量”组合产生一个不同的搜索值，使其可以跟踪这些状态。

​	上述漏洞触发在B分区，当{blockalign = 1280, samplesperblock = 8}时会触发。我们的方法可以通过结合或突变以前的种子，生成违反多个"不变量"的输入，每个都违反一个或多个不同的"不变量"。

### 3. Pruning the Generated Checks-修剪生成的Check

​	这里设计了三类修剪规则以排除不必要的/有害的“不变量”。

​	1）第一类需要丢掉的“不变量”是不可能被违反的：

​	**<u>例如，unsigned integer >= 0</u>。**其不可能被违反，对测试没有帮助。

​	为了识别类似的情况，我们对被测程序的每个函数进行了价值范围分析[36]。参数和全局存储最初是不受限制的，分析产生的函数变量界限在任何执行中都是成立的。利用这些分析出来的范围信息，指示分析器永远不要生成逻辑上比这些静态分析出的限制更弱的逻辑“不变式”。

​	2）第二类是包含无关变量：

​	为被测程序的每个函数计算可比较性集：每个变量只属于一个这样的集，将不同集的变量结合在一起的“不变量”被丢弃。

​	最初为每个变量创建一个单独的集合，然后使用基于统一的策略，遍历函数指令，并在两个变量作为同一语句的操作数出现时合并这两个变量的集合。最终，一个可比性集合包含了参与相关计算的变量。这很少有例外：例如，在一个数组指针计算中，我们不合并基数和索引元素的集合，因为它们没有直接关系。

​	3） 第三类是与其他“不变量”的条件重叠：

​	如果“不变量”逻辑重叠，就存在可以优化的空间。

### 4. Corpus Selection-语料库选择

​	仅使用有效文件是不够的。

​	只要该模糊器在达到新的覆盖点时有放缓的迹象，就可以作为语料库。（why？）

## REFERENCE

- 软件分析：
  - [南京大学《软件分析》课程笔记01 Introduction_CSDN](https://blog.csdn.net/qq_41048815/article/details/118963223)
- C/C++:
  - [Variable Length (Using the GNU Compiler Collection (GCC))](https://gcc.gnu.org/onlinedocs/gcc/Variable-Length.html)
  - [c99变长数组_C语言变长数组：使用变量指明数组的长度 CSDN博客](https://blog.csdn.net/weixin_42141437/article/details/112239845)

