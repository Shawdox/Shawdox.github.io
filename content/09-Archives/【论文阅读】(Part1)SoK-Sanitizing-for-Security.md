---
date: 2024/01/04 
title: (论文阅读)(Part1)SoK-Sanitizing for Security
author: Shaw
categories: Paper
tags: ["Sanitizer"]
---

# (Part1)SoK: Sanitizing for Security

>**作者：**Dokyung Song, Julian Lettner, Prabhu Rajasekaran(UC Irvine)
>
>**会议：**S&P'19

## ABSTRACT

C 和 C++ 编程语言出了名的不安全，但仍然不可或缺。因此，开发人员采用多管齐下的方法，抢在对手之前发现安全问题。这些方法包括手动、静态和动态程序分析。动态错误查找工具（即 "sanitizers"）可以发现其他类型分析无法发现的错误，因为它们可以观察到程序的实际执行情况，因此可以直接观察到发生的不正确程序行为。

学术界已经开发了大量的sanitizer原型，实践者也对其进行了改进。我们系统地概述了sanitizer，重点介绍了它们在发现安全问题方面的作用。具体来说，我们对现有工具及其涵盖的安全漏洞进行了分类，描述了它们的性能和兼容性，并强调了各种权衡。



## Exploit Mitigations VS. Sanitizers

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240104160518671.png" style="zoom: 67%;" />

Sanitizer 与许多著名的Exploit Mitigation(漏洞利用缓解措施)类似，它们可以通过插入inlined reference monitors（IRM）等类似方式对程序进行检测。尽管有这些相似之处，Exploit Mitigation和 sanitizer 在目标和用例上却有很大不同。

这两类工具的最大区别在于它们执行的安全策略类型。Exploit Mitigation工具部署的策略旨在检测或防止攻击，而sanitizer工具则旨在精确定位有漏洞的程序语句。控制流完整性（CFI）[10]、[11]、数据流完整性（DFI）[12]和写完整性测试（WIT）[13]都是Exploit Mitigation工具的例子，因为它们能检测出合法控制流或数据流路径的偏差，这些偏差通常是漏洞利用的结果，<u>但不一定发生在易受攻击程序语句的精确位置</u>。与此相反，边界检查工具(bounds checking tool)可被视为 sanitizer，因为违反其策略会直接在有漏洞的语句位置触发。

有些工具会选择性地应用 sanitizer 技术，并可能与Exploit Mitigation相结合。例如，Code-Pointer Integrity（CPI）仅在程序直接或间接访问敏感代码指针时执行边界检查（许多 sanitizer 使用的一种 sanitization 技术）[14]。因此，我们认为 CPI 是一种Exploit Mitigation，而不是一种 sanitizer，因为 CPI 只能检测出所有可使用边界检查检测出的漏洞中的一小部分。

Exploit Mitigation是要在生产中部署的，因此对设计的各个方面提出了严格的要求。首先，如果Exploit Mitigation程序会产生不可忽略的运行时开销，那么它们在现实世界中就很少被采用[15]。<u>Sanitizer 对性能的要求不那么严格，因为它们只用于测试</u>。其次，Exploit Mitigation中的假阳性检测是不可接受的，因为它会终止程序。Sanitizer 可以容忍假阳性（FPs），但以开发人员愿意审查错误报告为限。最后，出于可靠性和可用性的考虑，在生产系统中允许并经常希望存在一些benign error（如写入填充），而 sanitizer 则旨在精确检测这些错误，因为它们的可利用性是未知的。

## Low-level Vulnerabilities

鉴于与安全相关的 Bug 种类繁多，我们将重点放在对 C/C++ 有特定安全影响的 Bug 上。这不仅包括未定义的行为，还包括在缺乏类型和内存安全的情况下具有潜在危险的定义明确的行为。我们将简要介绍这些漏洞，以及如何利用它们来泄漏信息、提升权限或执行任意代码。

### 1. Memory Safety Violations

> **Intended referent:** 指一个指针预期的合理范围。其可能是：在分配和取消分配之间（heap-allocated referents）、函数调用和返回之间（stack-allocated referents）、创建和销毁相关线程之间（threadlocal referents）或无限期（global referents）是有效的。

#### 1.1 Spatial Safety Violations

访问不在指针的intended referent范围内的内存行为就被视为spatial safety violation，例如buffer overflow。

如果易受攻击的访问对象是一个subobject（如结构体字段），而攻击者向同一object中的另一个subobject写入了内容，那么我们就称之为intra-object overflow（对象内溢出）。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240104162449326.png" style="zoom:67%;" />

#### 1.2 Temporal Safety Violations

虽然访问指针的intended referent范围合理，但访问时该referent已经不再可用，例如UAF。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240104162654269.png" style="zoom:67%;" />

### 2. Use of Uninitialized Variables

变量在初始化之前有一个不确定值，如果源变量和目标变量都是无符号的窄字符类型，<u>C++14 允许这种不确定值传播到其他变量。</u>对未初始化变量的任何其他使用都会导致未定义行为。这种未定义行为的效果取决于许多因素，包括编译程序时使用的编译器和编译器标志。

在大多数情况下，不确定值实际上是先前已释放变量的（部分）内容，这些变量与未初始化变量占用了相同的内存范围。由于这些先前已重新配置的变量有时可能持有安全敏感值，因此读取未初始化内存可能是信息泄漏攻击的一部分。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240104163046144.png" style="zoom:67%;" />

### 3. Pointer Type Errors

C 和 C++ 支持多种转换操作符和语言结构，这些操作符和语言结构会导致内存访问错误地解释存储在引用对象中的数据，从而违反类型安全。

<u>指针类型错误通常是由不安全的类型转换造成的，C 允许指针类型之间的所有类型转换，以及整数和指针类型之间的类型转换</u>。

C++ 的 reinterpret_cast 类型转换操作符同样不受任何限制。static_cast和dynamic_cast操作符确实有一些限制：static_cast禁止指针到整数的转换，也禁止指针到通过继承不相关的对象之间的转换。不过，它允许将指针从基类投向派生类（也称为下投），也允许从 void* 类型投向 void* 类型。当下投指针既没有其引用对象的运行时类型，也没有引用对象的一个祖先类型时，就会发生错误投射（通常称为类型混淆）。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240104163226790.png" style="zoom:67%;" />

### 4. Variadic Function Misuse

C/C++ 支持Variadic Function（可变函数），除了接受固定数量的常规函数参数外，还接受可变数量的可变函数参数。Variadic Function的源代码中并不指定这些可变参数的数量或类型。可变参数可以使用 va_arg 访问并同时进行类型转换。<u>一般来说，无法静态验证 va_arg 是否访问了有效参数，或是否将参数类型转换为有效类型</u>。缺乏这个问题的静态验证可能导致type errors、spatial memory safety violations和uses of uninitialized values。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240104163700886.png" style="zoom:67%;" />

### 5. Other Vulnerabilities

在缺乏类型和内存安全的情况下，还有其他一些操作可能会带来安全风险，值得注意的例子包括在内存分配或指针运算操作中使用此类值时可能被利用的溢出错误。如果使用攻击者控制的整数值来计算缓冲区大小或数组索引，攻击者就可能溢出该值，分配比预期更小的缓冲区（整数溢出）：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240104163851966.png" style="zoom:67%;" />

或编译器优化导致的问题：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240104164020673.png" style="zoom:67%;" />

编译器开发人员经常在他们的编译器中添加这种激进的优化。因此，有人将未定义行为称为ime bombs，定时炸弹。

## Bug Finding Techniques

### 1. Memory Safety Violations

内存安全漏洞查找工具可检测指针的解引用，这些指针要么不指向其intended referent（即空间安全违规），要么针对的Intended referent已不再有效（即时间安全违规），有两大类工具可用于检测这些错误。

- ***Location-based Access Checkers***-->不需要插桩

Location-based Access Checkers可检测对无效内存区域的内存访问。这些检查器有一个元数据存储空间，用于维护可寻址地址空间（部分）每个字节的状态，每当程序尝试访问内存时，检查器都会查阅该元数据存储空间，以确定内存访问是否有效。

Location-based Access check program可以使用redzone insertion [27]-[31] 或guard pages[32], [33] 来检测空间安全违规。这些技术中的任何一种都可以与reuse delay相结合，以额外检测时间安全违规[27]-[29]，[31]-[36]。Location-based Access Checkers的运行时<u>性能开销较低</u>，而且与未经插桩的代码高度兼容。缺点是这些工具不够精确，因为它们只能检测指令是否访问了有效内存，而不能检测访问的内存是否属于指令的intended referent。这些工具通常会产生较高的内存开销。

- ***Identity-based Access Checkers***-->需要插桩

Identity-based Access Checkers可检测出不针对intended referent的内存访问。这些工具为每个已分配的内存对象维护元数据（如边界或分配状态），并有一套机制来确定程序中每个指针的intended referent。元数据查询可在程序使用算术运算计算新指针时进行，以确定计算结果是否为有效指针，和/或在指针取消引用时进行，以确定取消引用是否访问了指针的预定引用对象。

Identity-based Access Checkers可以使用每个对象的边界跟踪[34]、[37]-[43]或每个指针的边界跟踪[44][55]来检测空间安全违规，还可以通过重用延迟[55]、锁定和密钥检查[46]、[47]、[56]或悬空指针标记[57]-[60]来检测时间安全违规。

Identity-based Access Checkers比Location-based Access Checkers更精确，因为它们不仅能检测对无效内存的访问，还能检测对intended referent之外的有效内存的访问。不过，与Location-based Access Checkers相比，这些工具的运行时性能开销更高。基于Identity-based Access Checkers通常与未被插桩的代码不兼容，它们的误报检测率也高于基于位置的检查器。

------

- ***Red-zone Insertion***

Location-based access checkers中可以使用Red-zone Insertion技术来在内存对象之间插入redzone，redzone被视为非法内存区域，代表工具：

1. Purify；
2. Memcheck；
3. Light-weight Bounds Checking（LBC）。

使用readzone insertion based location-based access checker通常会产生较低的运行时性能开销，但精度有限，因为它们只能检测以红区为目标的非法访问。而针对有效对象的非法访问则无法检测，因为有效对象可能与intended referent属于同一分配，也可能不属于同一分配。基于插入红区的工具也无法检测对象内溢出错误，因为它们不会在子对象之间插入红区。虽然技术上可行，但在子对象之间插入红区会导致过多的内存开销，而且会改变父对象的布局。因此，任何访问父对象或其子对象之一的代码都必须进行修改，这也会破坏与不了解已更改数据布局的外部代码的兼容性。

- ***Guard Pages***

可在每个分配的内存对象之前和/或之后插入不可访问的保护页，访问保护页面的越界读写会触发页面故障，进而在应用程序中触发异常。这种利用分页硬件检测非法访问的方法，允许运行基于位置的访问检查程序运行未经插桩的load和store指令。

不过，使用保护页会产生较高的内存开销，因此对于工作集较大的应用程序来说，这种技术并不实用。微软意识到了这个问题，并在 PageHeap [33] 中增加了一个选项，即用保护块而不是完整的保护页来包围内存对象。PageHeap 使用填充模式填充这些保护块，并在释放内存对象时验证该模式是否仍然存在。严格来说，这种技术不如红区插入技术，因为它只能检测越界写入（而不是读取），而且直到被覆盖的对象被释放时，它才会检测到非法写入。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240104170541686.png" style="zoom:67%;" />

- ***Per-pointer Bounds Tracking***

基于身份的访问检查器还可以为每个内存对象而不是每个指针存储边界元数据.

这种方法由 Jones 和 Kelly（J&K）率先提出，解决了与每对象边界跟踪相关的一些兼容性问题[34]。每个对象的边界跟踪器可以维护边界元数据，而无需检测指针的创建和赋值操作。跟踪器只需拦截对内存分配（即 malloc）和去分配（即 free）函数的调用即可，<u>即使在未完全插桩的程序中也能做到这一点</u>。

由于边界元数据只针对对象而非指针进行维护，因此很难将指针与其intended referent联系起来。虽然可以使用元数据存储中基于范围的查找来找到界内指针的预定引用，但这种查找不会返回界外（OOB）指针的正确元数据。因此，J&K 建议对指针运算操作进行检测，并在指针越界时使其失效。任何后续的取消引用都会触发故障，然后可以捕获故障以输出警告。

- ***Reuse Delay***

基于位置的访问检查器可以在元数据存储中将最近重新分配的对象标记为无效，<u>方法是用红色区域[27]-[29]、[31]、[34]或保护页[32]、[33]、[35]、[36]代替它们。</u>

Dhurjati 和 Adve（D&A）提议使用静态分析来准确确定何时可以安全地重用已分配的内存[35]。D&A 将每个内存对象分配在自己的虚拟内存页上，但允许对象通过将虚拟内存页别名为相同的物理页来共享物理内存页。当程序释放内存对象时，D&A 会将其虚拟页面转换为保护页面。D&A 还利用一种名为 "自动池分配"（Automatic Pool Allocation）的静态分析方法，将堆划分为多个池[62]。这种分析可以推断一个池何时不再可访问（即使是通过潜在的悬空指针），此时池中的所有虚拟页都可以被回收。Dang 等人提出了一种不使用池分配的类似系统，因此可用于无源程序[36]。与 D&A 类似，Dang 等人将所有内存对象分配在各自的虚拟页上。当一个对象被取消分配时，Dang 等人就会取消该对象虚拟页的映射。这实际上实现了与保护页相同的目标，但允许内核释放虚拟页的内部元数据，从而减少了物理内存开销。为了防止重复使用未映射的虚拟页，Dang 等人建议在高水位（即程序中使用过的最高虚拟地址）处映射新页。虽然这并不能完全排除未映射虚拟页的重复使用，但其理念是，在 64 位地址空间中，重复使用不太可能发生。

- ***Lock-and-key***

基于身份的检查器可以通过为每个已分配的内存对象分配唯一的分配标识符（通常称为密钥），并将该密钥存储在lock location中来检测违反时间安全的情况 [46], [47], [56]，当相关对象被解除分配时，检查器会从锁定位置撤销密钥。

- ***Dangling Pointer Tagging***

标记悬空指针的最直接方法是将传递给 free 函数的指针相关值或边界作废[49]。空间内存安全违规检测机制会在此类指针稍后被取消引用时触发警告。这种方法的缺点是没有标记悬空指针的副本，而这些副本也可能在以后被使用。

------

### 2. Use of Uninitialized Variables

- ***Uninitialized Memory Read Detection***

通过在元数据存储中<u>将新分配对象占用的所有内存区域标记为未初始化</u>，基于位置的访问检查程序可以扩展到检测对未初始化内存值的读取[27]。这些工具会检测读取指令，如果读取的是未初始化的内存区域，就会触发警告；如果写入指令，就会清除覆盖区域的未初始化标记。请注意，将内存区域标记为未初始化并不等同于将其标记为redzone，因为对红色区域的读取和写入访问都会触发警告，而对未初始化内存的访问只在读取时才会被禁止。

- ***Uninitialized Value Use Detection***

上述检测对未初始化内存的读取会产生许多假阳性检测，因为 C++14 标准明确允许未初始化值在程序中传播，只要它们未被使用。例如，将部分未初始化的结构体从一个位置复制到另一个位置时，就会出现这种情况。

Memcheck 试图只检测未初始化值的使用，将错误报告限制在：(i) 取消引用（部分）未定义的指针；(ii) 在（部分）未定义值上分支；(iii) 将未定义值传递给系统调用；(iv) 将未初始化值复制到浮点寄存器[28]。为支持这一策略，Memcheck 为程序内存中每一个部分初始化的字节添加一个字节的影子状态。

这样，Memcheck 就能以bit级精度跟踪程序所有内存的定义性。Memcheck 近似于 C++14 的语义，但会产生假阴性（无法报告非法使用未初始化内存）和假阳性（报告合法使用未初始化内存），这是不可避免的，因为 Memcheck 是在二进制级别而非源代码级别运行的。

MemorySanitizer (MSan) 实现了与 Memcheck 基本相同的策略，但在编译器中间表示（IR）级别对程序进行检测[66]。IR 代码比二进制代码携带更多信息，这使得 MSan 比 Memcheck 更精确。MSan 不会产生假阳性（前提是整个程序都被检测到），假阴性也很少，其性能开销也比 Memcheck 低一个数量级。

------

### 3. Pointer Type Errors

- ***Pointer Casting Monitor***

指针转换监控程序通过 C++ static_cast 操作符检测非法downcast。非法downcast发生在下投的目标类型不等于源对象的运行时类型（或其祖先类型之一）时。

UndefinedBehaviorSanitizer [67] (UBSan) 和 Clang CFI [68] 中的检查程序通过比较目标类型和与源对象关联的运行时类型信息 (RTTI) 来验证静态下投操作的正确性。这就有效地将 static_cast 操作变成了 dynamic_cast。其缺点是，基于 RTTI 的工具无法验证缺乏 RTTI 的非多态类型之间的投递。

- ***Pointer Use Monitor***

C/C++ 支持几种以潜在危险方式转换指针类型的构造；C-风格的cast、reinterpret_cast 和联合都可用于绕过编译时和运行时类型检查。不过，将指针类型转换监控扩展到这些构造可能会导致误报。



### 4. Variadic Function Misuse

- ***Dangerous Format String Detection***

格式化字符串漏洞是最常见的变种Variadic Function Misuse漏洞，但大多数工作都只侧重于检测对 printf 的危险调用。在这些努力中，有一些工具限制了格式字符串中 %n 限定符的使用 [76], [77]。该限定符可用于将 printf 写入调用者指定的内存位置。然而，这种危险的操作 [2] 是 printf 函数特有的，因此上述工具的适用性有限。

- ***Argument Mismatch Detection***

FormatGuard 可以防止 printf 读取比调用者传递的参数更多的参数 [78]。FormatGuard 的做法是将调用重定向到受保护的 printf 实现，该实现在通过 va_arg 获取变量参数时会递增计数器。HexVASAN 将参数计数推广到所有变量函数，并增加了类型检查功能 [79]。

HexVASAN 会在变参函数的调用位置记录传给被调用者的参数数量和类型，并将这些信息保存在元数据存储中。然后，该工具利用 va_start 和 va_copy 操作从元数据存储中检索信息，并利用 va_arg 操作检查正在访问的参数是否在给定的参数个数范围内，是否属于给定的类型。



### 5. Other Vulnerabilities

这些工具可检测到其他未定义的行为，或定义明确但可能是意外和危险的行为。

- ***Stateless Monitoring***

<u>UndefinedBehaviorSanitizer (UBSan)</u>是一个用来检测未定义行为的Sanitizer，其检测范围包括：整数溢出、浮点数\整数÷零，无效位移操作，类型转换导致的浮点数溢出（例如将一个double转换为float），使用错位指针（misaligned pointer），空指针解引用，有返回值的函数没有返回。

UBSan 的大多数检测功能都是无状态的，因此可以一起被开启，而不会相互干扰。

UBSan 还能检测几种定义明确但很可能是非预期的行为。例如，语言标准规定无符号整数在溢出时要进行循环（wrap-arounds）。然而，这种定义明确的行为往往是意想不到的，也是 bug 的常见来源，因此 UBSan 可以有选择地检测这些无符号整数环绕（wrap-arounds）。

>What is a misaligned pointer?
>
>[c - What is a misaligned pointer? - Stack Overflow](https://stackoverflow.com/questions/20183094/what-is-a-misaligned-pointer)

