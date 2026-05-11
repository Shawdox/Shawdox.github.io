---
date: 2023/07/03 20:35:37
title: (论文阅读)WasmFuzzer- A Fuzzer for WebAssembly Virtual Machines
author: Shaw
categories: Paper
tags: ["Fuzzing","WASM"]

---

# WasmFuzzer: A Fuzzer for WebAssembly Virtual Machines

>**时间：**2022
>
>**作者：**Bo Jiang, Zichao Li（北航）
>
>**期刊：**SEKE（CCF-C）

## Abstract

​	WebAssembly是一种快速、安全、可移植的低级语言，适用于各种应用场景，Web浏览器或区块链平台广泛使用WebAssembly虚拟机作为执行引擎。当Wasm虚拟机的实现存在bug时，WebAssembly的执行可能导致应用程序中的错误或漏洞。由于WASM虚拟机的语法检查机制，二进制级别的fuzzing无法暴露bug，因为大多数输入无法到达WASM虚拟机的深层逻辑。

​	在这项工作中，我们提出了WasmFuzzer，<u>一个用于WASM虚拟机的bytecode级fuzzing工具</u>。WasmFuzzer提出在Wasm字节码级别上生成初始种子进行fuzzing，并设计了一套系统的Wasm字节码突变mutation operators。此外，WasmFuzzer还提出了一种自适应的突变策略，以寻找适用于不同fuzzing目标的最佳mutator。

​	我们对三个真实的Wasm虚拟机进行评估，结果显示WasmFuzzer在代码覆盖率和唯一崩溃(unique crash)方面明显优于AFL。



>"Unique crash"（唯一崩溃）指的是在软件或系统中发生的独特的错误或异常情况，导致程序的崩溃或异常终止。这种崩溃是指与其他崩溃不同的、独特的错误情况，可能由于特定的输入或特定的执行路径引起。在上述文本中，作者提到WasmFuzzer在唯一崩溃方面的表现优于AFL，意味着WasmFuzzer能够发现更多不同于其他测试工具的独特错误情况。

## 问题背景

​	WebAssembly是在WebAssembly虚拟机[7]中执行的，现有的Wasm虚拟机实现包括<u>WAVM[8]、Wasmtime[9]、Wasmer[10]</u>等。虚拟机是执行WebAssembly的基础设施，其应该正确、高效、鲁棒地实现。然而，如果虚拟机的实现有错误，WebAssembly的执行可能会导致错误的结果，或者程序会异常退出，其中一些错误甚至会导致安全漏洞。例如，在2018年，<u>有7个CVE报告给名为WAVM的Wasm虚拟机[8]</u>，为了避免这些情况，我们可以采用模糊技术[11]来识别虚拟机实现中的错误。

​	**针对Wasm VM的fuzzing需要面对两大挑战：**

- 首先，Wasm VM经常在执行前进行Wasm代码验证（validation），这使得它很难产生有效的输入以达到虚拟机内的深层逻辑。虽然主流的fuzzing软件AFL可以用来测试用C/C++编写的WebAssembly虚拟机，但它们生成的测试用例都是二进制数据，没有考虑Wasm字节码语法，很难通过Wasm虚拟机通常进行的代码验证；
- 其次，WASM VM有许多不同的实现，它们有不同的代码结构和bug模式，使用固定的突变策略很难适应这些Wasm VM之间的差异，从而达到最佳的fuzzing效果。

## 贡献

- 提出了一个名为WasmFuzzer的Wasm字节码级fuzzing框架，用于Wasm虚拟机，该工具可以生成和变异Wasm字节码模块，以达到Wasm虚拟机的深层逻辑;
- 提出了一种自适应突变策略，可以动态地更新不同mutation operator的概率，通过这种方式，我们可以为测试目标优化mutation operator的配置；
- 用WasmFuzzer对3个现实生活中的Wasm虚拟机进行了系统的fuzzing测试。我们的评估结果显示，WasmFuzzer在代码覆盖率和错误检测方面都比AFL更有效，而且WasmFuzzer在WAVM、WAMR和EOS-VM中检测到235个独特的崩溃。

## 模型

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230703210321.png" style="zoom:67%;" />

### 1. The Generation of Wasm Bytecode

​	为WASM指令生成对应的参数分为两种情况：

- **从module中选择参数：**如`global.set  id`指令，其作用是将编号为id的全局变量置于栈顶，故其参数范围只能是module中global array中的参数（否则就会非法），故对于这种指令仅仅从module中选择对应的参数；
- **从对应数据域内选择参数：**对于确定参数type的指令，从对应的数据域随机选择一个数即可。

​	WasmFuzzer扩展了WebAssembly Binary Toolkit（WABT）以帮助生成不同种类的指令。具体来说，它使用WABT的内部功能来生成不同种类的操作码，这些操作码与相应的参数相结合，以建立不同的指令。最后，这些指令被进一步组装成函数和模块，作为种子输入。



### 2.  Mutation Operator for Wasm Bytecode

#### 2.1 Mutation operations

​	Mutation operations被分为两类，对指令的变异和对其它的变异:

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230703211206.png" style="zoom:67%;" />

​	为了确保变异的WebAssembly代码能够通过Wasm VM的验证[12]过程，我们控制不同的mutator的概率，使新生成的Wasm模块有更大的机会成为有效的输入。

#### 2.2 Adaptive Random Mutation Strategy

​	在变异步骤中，每个mutator都有被选中的概率。一般来说，我们的突变策略将通过动态增加mutator的概率来奖励导致新的代码覆盖率或崩溃的mutator，这样一来，那些更有 "前途 "的mutator就有更大的机会被选中。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230703211713.png" style="zoom:67%;" />

#### 2.3 Test Oracle and Bug Report Generation

​	当被测试的软件在fuzzing过程中崩溃或中止时，系统将发出信号，如SIGSEGV或SIGABT，WasmFuzer将捕获这些信号来报告错误。此外，WasmFuzzer还利用AddressSanitizer[13]来检测与内存有关的软件错误，如UAF、缓冲区溢出、堆栈溢出、内存泄漏等。

​	当WasmFuzzer检测到一个错误，它将生成错误报告，以方便进一步调试。错误报告包括两个部分：引发独特崩溃的Wasm字节码，以及引发独特挂起的Wasm字节码。通过 "独特"，它意味着这些Wasm字节码的执行导致了独特的代码路径。此外，我们还测量了在fuzzing过程中实现的代码覆盖率，作为另一个指标。

​	

### 3. EVALUATION

​	测试了三个WASM VM：WAVM, WAMR, EOS VM，都是使用C/C++编写。

- ***WebAssembly virtual machine***（github 2.5k starred），WAVM，是一个为非浏览器WASM应用设计的应用；
- ***WebAssembly Micro Runtime***（github 3.9k starred），WAMR，是一个小型WASM虚拟机，经常用在嵌入式系统中；
- ***EOS-VM***，是一个为区块链应用设计的WASM虚拟机。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230703212629.png" style="zoom:67%;" />

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230703212652.png" style="zoom:67%;" />