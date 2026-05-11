---
date: 2023/03/15 15:29:02
title: Demons in the Shared Kernel--Abstract Resource Attacks Against OS-level Virtualization
author: Shaw
categories: Paper
tags: ["Vulnerability" , "AEG" , "Cloud"]
---

# Demons in the Shared Kernel: Abstract Resource Attacks Against OS-level Virtualization

>**时间：**2021.11
>
>**作者：**Nanzi Yang（西电）、Wenbo Shen（浙大）
>
>**会议：**CCS

对docker的一种Ddos攻击，实现了自动化检测。

## ABSTRACT

​	由于其更快的启动速度和更好的资源利用效率，操作系统级虚拟化(OS-level virtualization)已被广泛采用，并已成为云计算的一项基本技术。与硬件虚拟化相比，操作系统级虚拟化利用共享内核设计来达到更高的效率，并在共享内核上运行多个用户空间实例（又称容器）。然而，在本文中，我们揭示了一个新的攻击面，此漏洞是操作系统级虚拟化技术所固有的，会影响到Linux、FreeBSD和Fuchsia。

​	产生漏洞的根本原因是，**<u>操作系统级虚拟化中的共享内核设计导致容器直接或间接地共享成千上万的内核变量和数据结构。在不利用任何内核漏洞的情况下，非特权容器可以轻易地用尽共享的内核变量和数据结构实例，对其他容器进行DoS攻击。</u>**与物理资源相比，这些内核变量或数据结构实例（称为抽象资源）更普遍，但受到的保护不足。

​	为了显示限制**抽象资源**（Abstract Resources）的重要性，我们针对操作系统内核的不同方面进行了抽象资源攻击。结果表明，攻击抽象资源是非常实用和关键的。我们进一步进行了系统分析，以识别Linux内核中易受攻击的抽象资源，成功检测出1010个抽象资源，其中501个可以被动态地重复消耗。我们还在四大云厂商的自部署共享内核容器环境中进行了攻击实验。结果显示，所有环境都容易受到抽象资源的攻击。我们得出结论，限制抽象资源的使用是很难的，并给出了减轻此风险的多种策略。



## 针对容器的抽象资源攻击

​	操作系统级虚拟化可以在同一个内核上运行多个用户空间容器，与硬件虚拟化相比，其减轻了模拟操作系统内核的负担，故有着更快的速度和更高的资源利用率。用户空间的操作系统级虚拟化实例，在FreeBSD上叫jails、在Solaris上叫Zones、在Liunx上叫containers。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230315142400.png" style="zoom:67%;" />

​	**由于共享内核机制的存在，注意到，底层的操作系统内核包含数为容器提供服务的十万个变量和数据结构实例**。因此，这些容器直接或间接地共享这些内核变量和数据结构实例。

​	这些抽象资源可以被利用来进行DoS攻击，并且系统对它们的保护措施往往不足。内核和容器开发者更注重保护物理资源而不是抽象资源。例如，Linux内核提供控制组来限制每个容器实例的资源使用。然而，在13个控制组中，有12个是针对物理资源的，限制了CPU、内存、存储和IO的使用。只有PIDs控制组是为限制抽象资源PID而设计的。因此，数百个容器共享的抽象资源没有任何限制，如global dirty ratio、open-file structs、pseudo-terminal structs等，这使得它们容易受到DoS攻击。

​	举个例子，下图是Linux内核中的一个全局变量**nr_files**及其利用函数，nr_files是系统中任意时刻文件数量的上限值，限制的文件总数。然而Linux内核并没有对nr_files变量提供任何控制隔离措施，因此，所有容器都可以直接控制nr_files的值。

​	在Linux世界中，所有几乎所有操作都可以看做文件操作，计时器、事件生成、运行命令等。一个容器可以在几秒内轻松消耗完nr_files的值，这样导致的结果就是同一系统内的其它容器在系统资源还很充裕的时候，一条命令、一个程序都不能运行。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230315143405.png" style="zoom:67%;" />

## 自动检测可利用的抽象资源

​	文章的整体思路就是围绕着抽象资源的检测与利用进行。为了检测出系统中可利用的抽象资源，文章提出了：

- ***configuration-based analysis*** 和***access-based analysis***方法用于查找内核中共享在容器中的抽象资源；
- ***Syscall Reachability Analysis***和三个***Restriction Analysis***方法用于确定抽象资源可以被容器消耗完。

### 1. Configuration-based Analysis & Access-based Analysis

#### 1.1 configuration-based analysis

​	Linux下的sysctl命令可以查看/修改内核参数，这些参数位于/proc/sys目录下。**注意到，这些sysctl配置大多用于抽象的资源限制，比如限制文件数量fs.file-nr或内存大页面vm.nr_hugepages。因此，所有的容器都在共享由sysctl配置指定的相同的全局限制。**这种sysctl配置提供了关于容器之间可共享的抽象资源的重要线索。

​	故这里的configuration指的就是sysctl配置参数。基于配置的分析分为三步：

1. 首先，它使用特定的sysctl数据类型来识别所有与sysctl相关的数据结构。这些数据结构包含可配置的sysctl内核参数；
2. 其次，sysctl数据结构通常包含在/proc/sys/文件夹中显示sysctl值的函数。因此，通过分析该函数，我们能够准确地找出该内核参数的变量；
3. 最后，如果一个内核参数被用于限制资源消耗，其相应的变量应该出现在比较指令中。因此，我们按照使用-定义链来检查所确定的变量的使用情况，如果它在比较指令中被使用，就把它标记为抽象资源



​	如下图所示，Linux的proc文件系统使用数据结构ctl_table来配置sysctl内核参数。我们在LLVM中设计并实现了一个程序间分析通道，分析程序首先遍历所有内核全局变量来查找所有ctl_table数据结构，跟随.proc_handler回调指针启动程序间分析以获得确切的变量，定位到19行的nr_files关键变量。最后，检查所有已识别的关键变量的使用情况。**如果一个关键变量在比较指令中被使用（即LLVM IR中的icmp），就会记录这些位置并将这个变量标记为抽象资源**（25行，nr_files）。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230315145607.png" style="zoom:67%;" />



#### 1.2 access-based analysis

​	除了sysctl配置，Linux内核还使用锁或原语机制来保护并发访问的资源。**因此，我们使用并发访问性质作为标识一组可共享的抽象资源的标志。**如果某个数据结构本身就是锁，或者在上锁/解锁之间被定量修改，我们就将其定位为抽象资源。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230315151312.png" style="zoom:67%;" />

​	同时，分析方法还考虑了atomic和percpu计数器，其分析方法都集成在LLVM中。

### 2. Syscall Reachability Analysis & Restriction Analysis

#### 2.1 syscall reachability analysis

​	为了确定筛选出来的抽象资源可以被容器消耗，我们根据内核控制流图进行传统的后向控制流分析，其中间接调用是根据结构类型来解决的[42, 70]。如果没有从系统调用条目到抽象资源消耗点的路径，我们就把这个抽象资源从容器中标记为不可达。

#### 2.2 restriction analysis

​	仅有可达性分析是不够的，我们需要进一步确保路径上没有额外的针对容器的限制。如seccomp、命名空间、控制组以及每个用户的资源限制。

##### 	2.2.1 seccomp

​	Seccomp是一种用于系统调用过滤的机制。我们对seccomp的限制分析中，使用Docker默认的seccomp配置文件[15]，它阻止了50多个系统调用。在所有从系统调用条目到资源消耗点的路径中，过滤掉源自任何被阻止的系统调用的路径。

##### 	2.2.2 per-user

​	在实际部署中，容器通常使用不同的用户运行。因此，每个容器的资源消耗也被每个用户的资源配额所限制。例如，Linux提供了用户限制命令ulimit来限制特定用户的资源消耗。而ulimit的底层实现是使用rlimit来设置多个每个用户的资源配额。

​	除了ulimit，Linux还提供了一些接口，允许用户利用PAM（Pluggable Authentication Module）来部署每个用户的配额。PAM使用setup_limits函数[64]来设置每个用户的资源配额，它调用setrlimit来配置多个rlimit约束。对于由ulimit、rlimit和PAM限制的资源，攻击者容器不能消耗超过每个用户的配额。因此，它不能完全控制这些抽象的资源来发动DoS攻击。

​	由于ulimit和PAM都使用rlimit来设置每个用户的资源配额，我们需要分析rlimit并过滤出受其限制的抽象资源。对于rlimit分析，我们的关键观察是，rlimit值通常是在struct rlimit或struct rlimit64中指定的。因此，我们首先遍历内核IR，以确定所有从结构rlimit或结构rlimit64加载的变量。然后，我们进行数据流分析，跟踪这些变量的所有传播和使用情况，如果这些变量在任何比较指令中被使用，则标记这些函数。在这些函数中，rlimit被检查以限制某些资源。我们认为这些资源不能被攻击者容器用尽，因此我们根据这些函数过滤掉路径。我们的工具确定了40个检查rlimit的函数。

##### 	2.2.3 namespace

​	对于一个命名空间隔离的资源，Linux内核会在每个命名空间下为其创建一个 "副本"，这样在一个命名空间的修改就不会影响到其他命名空间。因此，为了确认容器的可控性，我们需要确保那些抽象资源不受名字空间的保护。**这里存在一个问题，即使Linux有关于命名空间的文档，也没有关于哪些抽象资源被命名空间所隔离的规范。**

​	<u>观察到，对于一个被命名空间隔离的资源，相应的数据结构有一个指针字段，指向它所属的命名空间。</u>因此，我们的工具首先遍历了内核中每个数据结构类型的所有字段。如果该类型有一个命名空间指针，我们就把它标记为一个被限制隔离的资源。其次，对于识别出的隔离资源，我们的工具用它来过滤§4.1中识别的共享抽象资源。请注意，由于不同命名空间之间的映射，一些命名空间隔离的资源可能仍然容易受到抽象资源的攻击。如§3.2.2所述，idr是由pid_namespace->idr隔离的。然而，在非根PID命名空间分配的每个idr都被映射到根PID命名空间的一个新idr，这样根命名空间就可以管理它。因此，根PID命名空间被所有PID命名空间的所有容器全局共享。因此，它仍然容易受到idr耗尽的攻击。在我们的分析中，我们手动过滤掉这些资源。



![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230315152653.png)

​	如图所示，通过两次分析，程序就可以自动识别内核中可利用的抽象资源。由于本文重点关注漏洞的AEG利用，这里的容器攻击难点其实就是<u>自动化查找抽象资源</u>，利用并不难，故本文到这里结束。