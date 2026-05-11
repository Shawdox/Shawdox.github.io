---
date: 2023/07/22 14:23:23
title: (论文阅读)GraphFuzz-Library API Fuzzing with Lifetime-aware Dataflow Graphs
author: Shaw
categories: Paper
tags: ["Fuzzing"]
---

# GraphFuzz: Library API Fuzzing with Lifetime-aware Dataflow Graphs

>**时间：**2022
>
>**作者：**Harrison Green、Thanassis Avgerinos
>
>**会议：**ICSE
>
>**开源：**https://github.com/ForAllSecure/GraphFuzz

## Abstract

​	提出了一种新fuzzer：GraphFuzz，能够自动测试**low-level Library APIs**。与其他fuzzer不同的是，GraphFuzz 将已执行函数的序列建模为数据流图，因此能够在data和execution跟踪级别执行graph-based mutations。GraphFuzz 自带自动规范生成器，可最大限度地减少开发人员的集成工作。

​	我们使用 GraphFuzz 对 Skia（经过严格测试的 Google Chrome 浏览器图形库）进行分析，并将 GraphFuzz 生成的fuzzing harnesses与手工优化、精心编写的 libFuzzer harnesses进行比较。我们发现，GraphFuzz生成的测试用例平均代码覆盖率提高了2-3倍，而开发工作量却很小，而且在此过程中还发现了以前未知的缺陷。我们通过分析另外四个开源库，发现了数十个以前未知的缺陷，从而证明了 GraphFuzz 在**low-level Library APIs**上的适用性。开发人员已经报告并修复了所有与安全相关的发现。



>A fuzzing harness is a test case or a particular test target.



## Background

​	<u>尽管近来fuzzing研究方兴未艾，但能够对 C/C++ 库进行模糊测试的系统却明显不足</u>。

- 现有的greybox-fuzzing（如 libFuzzer [3]）特别适合一次fuzz一个或两个端点，但要同时fuzz多个端点，则需要人工操作（如使用 FDP）；
- CSmith [6] 可以合成逼真的 C 代码，但当目标是 C 库而不是 C 编译器时，每次迭代时重新编译的代价都很高；
- FUDGE [7] 是一种很有前途的meta-fuzzing技术，它通过分析和切分客户端代码的种子语料库来自动生成harnesses，但是，它依赖于谷歌的内部基础设施，并不是开源的。

## API Fuzzing Methods

### Method 1:Harness

​	Standard grey-box harness可通过手动配置充当 API fuzzer，例如，开发人员可以通过在for-loop和/或switch语句中程序化地调用函数，对C++库进行fuzzing。通常情况下，来自非结构化模糊器的原始字节序列被用来初始化这些伪随机值。

​	同样，可以将 libProtobuf-mutator (LPM) [5] 与 libFuzzer [3] 等coveraged-based fuzzer结合使用，构建tree-based API fuzzer。例如，在 Chromium 的 AppCache fuzzer[12]中，Protocol Buffer实例代表了 IPC 的调用序列。

### Method 2:Code-gen

​	一些API fuzzer合成并运行程序源代码来测试API，这种方法最适用于 JavaScript 和 Ruby 等基于脚本的语言，因为它们在执行前不需要昂贵的编译步骤[6]。

​	虽然这些fuzzer可以通过使用context-free grammars或类似模型生成逼真的语法模式，但它们往往无法生成高级的、语义上有意义的代码。例如，Han 等人[13]指出，jsfunfuzz [9]（一种流行的 JavaScript fuzzer）99% 的测试用例仅在 3 条语句后就会引发运行时错误。

### Method 3:Harness-gen

​	相较于手工生成测试用例，也可以自动生成测试用例。

- IMF[14]跟踪系统调用日志以识别依赖关系，并合成可对这些系统调用进行fuzzing的 C语言测试用例；
- FUDGE[7]和FuzzGen[15]分析了大量客户端C/C++代码库，并提取代码片段来创建测试用例；

​	虽然上述这些系统可以生成不同的harnesses，但单个测试用例中的应用程序API调用结构在fuzzing时是静态的，只有值会发生变化。

### Method 3:Dynamic

​	在 API fuzzing的动态方法中，每个测试用例代表一个完整的 API 交互序列。Fuzzer动态处理每个测试用例，逐个调用端点。

​	动态fuzzer与code-gen的主要区别在于，在动态fuzzer中，API交互的结构是在fuzzing时指定的（作为测试用例的一部分），这使得fuzzer可以控制API调用的值和结构。Code-gen fuzzer也可以在fuzzing时通过重新编译（如 CSmith [6]）改变 API 调用的结构，而 **Syzkaller** [16] 和 GraphFuzz（本作品）等动态fuzzer则绕过了这一高成本的重新编译步骤。



## Contribution

​	为了弥补这一不足，我们引入了**<u>dataflow graphbased fuzzing</u>**，即用数据流图来表示库应用程序API的交互。我们介绍了 C/C++ 库中数据流图突变、生成和执行的算法，在许可协议下开源了基于数据流图的模糊测试实现（名为 GraphFuzz），并通过查找真实世界目标中的错误来证明其有效性，同时将其性能与 Skia 图形库中最先进的工具进行量化比较。

- **Model-based API Fuzzer Survey:** 对迄今为的model-based fuzzers进行了分类，并展示了 GraphFuzz 在设计领域的优势；
- **Dataflow graph-based fuzzing:** 我们正式定义了dataflow graphbased fuzzing，并介绍了在基于coverage的fuzzing中执行图突变和生成的算法；
- **GraphFuzz for C/C++:** 介绍了名为 GraphFuzz 的dataflow graphbased fuzzing开源实现，它能够对 C 和 C++ 库进行半自动模糊测试。我们通过发现现实世界中的错误来验证这项技术，并将其性能与当前最先进的harnesses进行量化比较。



## Model

### 1. 一些问题：

- **low-level library APIs 中的“low-level”代表什么？**

  “A low-level API, also known as a system-level or hardware-level API, refers to an interface provided by an operating system or software library that allows direct interaction with the underlying system or hardware components. It provides a way for developers to access and control the lower-level functionalities of a system, such as hardware devices, system calls, and system resources.”

- **dataflow graphbased fuzzing中的“graphbaesd”代表什么？**

  一个test case中有多个个API调用，这些调用组成一个API序列，以数据流图的方式表示。



### 2. Dataflow graph

​	下图是一个触发UAF漏洞的C++代码片段：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230722154718.png" style="zoom: 50%;" />

​	下图将这个Bug表示为了dataflow graph，数据流图，函数是顶点，对象是边：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230722154733.png" style="zoom: 67%;" />

​	**GraphFuzz 的关键是这两种表示法是等价的，我们可以通过编译和运行图 1 中的 C++ 代码或动态执行图 2 中的数据流图来调用此测试用例。**

#### 2.1 Graph Mutations

​	如何对数据流图做mutate；

#### 2.2 Graph Completion

​	如何补全图，以防止因为生成图本身的问题而在fuzzing中导致的假阳性。

#### 2.3 Graph Minimization

​	只保留那些表现出相同崩溃且较小的graph，我们就能获得接近手工最小化示例大小的数据流图。



### 3. Graphfuzz for C/C++

​	GraphFuzz分为两个部分：libgraphfuzz（一个用C++写的对数据流图做突变的工具）和gfuzz（Python 命令行工具，用于生成harness文件并执行图最小化和自动模式提取等其他任务。）

​	Graphfuzz harness的核心是`schema`，`schema`是一个用YAML写的可读文件，其中包含了API endpoints，object types等信息，GraphFuzz通过使用`schema`来自动生成exec和write fuzzer harnesses。

​	`schema`样例：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230722204159.png" style="zoom: 50%;" />

​	生成harness的过程：

1. **Instrumentation：**使用现有的fuzzer coverage sanitizer对目标library做插桩，例如在使用Clang是使用`-fsanitize=fuzzer`；
2. **Schema Inference(可选)：**可以使用使用 gfuzz 运行shcema提取工具，从library源代码中自动提取类、结构体、枚举、类型定义和方法到shcema中，生成的schema可以作为人工修改的基础；
3. **Manual Revision：**根据对API的理解，通过添加/删除类、添加函数或重新定义函数的输入和输出类型，手动修复schema；
4. **Harness Generation：**运行gfuzz工具来自动化生成两种harness：fuzzExec（运行数据流图）和fuzzWrite（将数据流图转换为普通C/C++代码，使测试样例可以被外部继续编译）；
5. **Compilation/Linking：** 将生成的两种hanesses link到目标库中来生成libFuzzer可执行文件。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230722204723.png" style="zoom: 50%;" />



​	GraphFuzz 是在 libFuzzer 基础上作为自定义突变引擎实现的（好巧妙的写法hhh），fuzzing的过程就如普通fuzzer一样，只是Mutation的过程变成了作者自定义的graph-level mutaitons。