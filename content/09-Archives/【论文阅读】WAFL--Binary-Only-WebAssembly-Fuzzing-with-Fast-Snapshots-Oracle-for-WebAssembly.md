---
date: 2023/07/03 21:29:58
title: (论文阅读)WAFL- Binary-Only WebAssembly Fuzzing with Fast Snapshots Oracle for WebAssembly
author: Shaw
categories: Paper
tags: ["Fuzzing","WASM"]
---

# WAFL: Binary-Only WebAssembly Fuzzing with Fast Snapshots

>**时间：**2021
>
>**作者：**Keno Haßler，Dominik Maier（柏林工业大学）
>
>**期刊：**ROOTS’21

## Abstract

​	WebAssembly 是一种用于二进制代码的开放标准，正在迅速在网络和其他领域得到应用。由于这些二进制文件通常是用低级语言（如C和C++）编写的，它们可能存在与传统对应物相同的错误。目前存在着很少的工具可以用于发现这些 WebAssembly 二进制文件中的错误。

​	WAFL 在 WAVM（WebAssembly 虚拟机）中添加了一组补丁，以生成用于流行的 AFL++ 模糊测试工具的覆盖率数据。借助于提前编译（AOT）的 WAVM，WAFL 的性能已经非常高效。WAFL 还添加了轻量级的虚拟机快照，通过用 WAFL 的快照替换传统上在 AFL++ 测试中使用的fork函数，WAFL 的测试可以在原始模糊测试性能方面甚至超过具有编译时插桩的本机测试。据我们所知，WAFL 是首个用于仅限二进制 WebAssembly 的覆盖率引导模糊测试工具，而无需源代码。

​	总结来说，WAFL 是一种用于对 WebAssembly 二进制文件进行模糊测试的工具，通过在 WAVM 中添加补丁和轻量级虚拟机快照，提供了高效的覆盖率引导模糊测试能力。



## 问题背景

​	随着Web的发展，进一步推进可移植性的想法，开放的WASI标准 [4] 允许独立的WebAssembly程序甚至在浏览器之外运行。其目标是创建一个真正通用的二进制平台，虽然围绕WASI的基础设施还很稚嫩，但已经开始逐渐增长。例如WebAssembly软件包管理器（wapm） [23]，使用wapm，用户可以下载在WebAssembly系统接口（WASI）启用的虚拟机上运行的WebAssembly二进制文件。以WebAssembly二进制文件形式分发的程序可以在每个可用运行时的平台上运行。

​	由于WebAssembly是像其他编译目标一样的编译目标，<u>**因此不安全源语言（如C）中的内存漏洞会被转化为WebAssembly，并且仍然存在潜在的漏洞**</u>。虽然该平台在开发时考虑了安全性并支持了一些现代的缓解措施，其仍可能存在可利用的bug，并导致恶意代码执行[9]。<u>到目前为止，用于发现WebAssembly二进制文件中的内存破坏的工具还很有限。</u>

​	<u>AFL在对有可用源代码的程序使用现有编译器的包装器 `afl-cc` 进行插桩，该工具向gcc或clang注入所需的pass。</u>AFL++中包含的InsTrim pass[6]通过分析cfg来提高插桩速度，它只标记了区分路径所需的一个块的子集（根据作者的说法，大约20%）。作为InsTrim中使用的块ID散列技术和传统的afl-clang通道的一个缺点，当需要插桩的基本块的数量增加时，这些算法很可能产生哈希碰撞。

​	LLVM的SanitizerCoverage[21] pass采取了一种更复杂的方法。它为每个边分配了一个防护变量（guard variable），并插入了一个使用该变量作为参数的回调函数。guard的初始化是在第二个回调函数中进行的，因此每个guard都可以被设置为一个唯一的数字，从而使其哈希值变得过时。<u>AFL++使用这个pass作为默认pass</u>。

​	本工作针对两个fully-featured wasm runtime：***WAVM*** 和 ***wasm3***。

## 贡献  

​	在这篇论文中，我们介绍了WAFL，一种用于 WebAssembly 二进制文件的高吞吐量fuzzing工具。WAFL 使用了著名的 **AFL++** 模糊测试工具进行输入生成，并利用轻量级虚拟机快照来提高性能。基于 WebAssembly 虚拟机（WAVM）的基础上，我们可以在<u>没有源代码</u>的情况下对 WebAssembly 二进制文件进行fuzzing。我们评估了其fuzzing速度，并展示了由于其快照机制，WAFL 甚至在 x86-64 平台上的性能超过了从源代码编译的简单测试用例。

- 我们开发了WAFL，这是一个开源的、针对纯二进制文件的WebAssembly fuzzer；
- 我们在基于wasm3的初始实现的基础上实现了多种改进，并进行了基准（benchmark）测试；
- 在其最终形式中，AOT编译、基于WAVM的快照fuzzer甚至超过了传统的编译、使用慢速fork系统调用的本地代码AFL。

## 模型

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230703215924.png)

### 1. 执行

​	在AFL++术语中，persistent mode[2]意味着在多次迭代中重复使用一个子进程。它允许通过在子进程中的相关代码区域进行循环来取代时间密集的fork()系统调用。**Persistent mode很适合我们的应用**，其中有趣的代码是预编译的目标。然而，如果一直不fork，目标在执行过程中可能会积累状态，甚至泄露内存，从而使持久性的fuzzing变得不稳定。因此，如果我们想在没有fork()的情况下进行fuzzing，我们必须在每次执行后重置目标状态。理想情况下，<u>我们希望在不对WebAssembly二进制文件打补丁的情况下完成这一工作，或者进一步对其进行检测，特别是在仅有二进制文件的情况下。</u>

​	WebAssembly定义了三种可能被目标程序改变的状态对象：globals、tables和memories[3]。目前，编译器只使用一种内存，即字节数组，在其中，他们创建了一个熟悉的布局，由Stack、Heap和Data部分组成[9]。基于这一观察，我们可以实现<u>虚拟机快照和恢复</u>：我们在第一次调用目标代码前不久拦截runtime，这时，线性内存已经被运行时初始化了。我们对其内容和大小创建一个快照，当控制流在每个循环迭代后返回到运行时，我们将内存缩小到其初始大小并写回快照。

### 2. 覆盖率

​	WAVM使用LLVM-JIT来将Wasm二进制文件翻译到平台原生代码，并在其上面执行一些优化pass。