---
date: 2023/05/04 14:33:12
title: (技术总结)The Kernel Address Sanitizer(KASAN)
author: Shaw
categories: Code
tags: ["Vulnerability" , "AEG" ]
---

# The Kernel Address Sanitizer(KASAN)

### 1. 兼容性

​	KASAN是一个动态内存安全错误检测器，旨在发现内核out-of-bounds和UAF错误。KASAN有三个模块：`Generic KASAN`、`Software Tag-Based KASAN`、`Hardware Tag-Based KASAN`。`Generic KASAN`兼容许多CPU架构，但性能开销很大；`Software Tag-Based KASAN`和`Hardware Tag-Based KASAN`都只兼容arm64架构的CPU，性能开销会更小。

​	一般的，称`Generic KASAN`和`Software Tag-Based KASAN`为**software KASAN**；

​	称`Software Tag-Based KASAN`和`Hardware Tag-Based KASAN`为**tag-based KASAN**。

​	`Generic KASAN`支持的指令集架构有：x86_64, arm, arm64, powerpc, riscv, s390, 和 xtensa；`tag-based KASAN`只支持arm64。

### 2. 编译器要求

​	KASAN对内存检查的逻辑是在编译的时候在内存访问操作之前插入相关检查指令，故需要相应的编译器支持该操作。

>​	`Generic KASAN`需要GCC 8.3.0+/任何版本的Clang(只要内核支持)；
>
>​	`Software Tag-Based KASAN`需要GCC 11+/任何版本的Clang(只要内核支持)；
>
>​	`Hardware Tag-Based KASAN`需要GCC10+/Clang12+。

### 3. 使用方法

​	开启KASAN需要在内核配置文件中开启对应配置：

```bash
CONFIG_KASAN=y
```

​	然后根据选择的KASAN类型选择标签：`CONFIG_KASAN_GENERIC`、`CONFIG_KASAN_SW_TAGS`、`CONFIG_KASAN_HW_TAGS`。

​	对于software KASAN，其需要指定其编译插装类型：`CONFIG_KASAN_OUTLINE`、`CONFIG_KASAN_INLINE`，outline类型生成体积更小的二进制代码，而inline类型速度比outline快两倍。

​	为了在报告中包括受影响的slab对象的stack traces，指定：`CONFIG_STACKTRACE`;包括受影响的物理页的stack traces，指定`CONFIG_PAGE_OWNER`并`page_owner=on`。

### 4. Report

​	默认情况下，KASAN只对第一个无效的内存访问打印错误报告。使用 `kasan_multi_shot`，KASAN对每一个无效的访问都打印一份报告。这会禁用 了KASAN报告的 `panic_on_warn`。

​	典型的KASAN报告如下所示:

```bash
==================================================================
BUG: KASAN: slab-out-of-bounds in kmalloc_oob_right+0xa8/0xbc [test_kasan]
Write of size 1 at addr ffff8801f44ec37b by task insmod/2760

CPU: 1 PID: 2760 Comm: insmod Not tainted 4.19.0-rc3+ #698
Hardware name: QEMU Standard PC (i440FX + PIIX, 1996), BIOS 1.10.2-1 04/01/2014
Call Trace:
 dump_stack+0x94/0xd8
 print_address_description+0x73/0x280
 kasan_report+0x144/0x187
 __asan_report_store1_noabort+0x17/0x20
 kmalloc_oob_right+0xa8/0xbc [test_kasan]
 kmalloc_tests_init+0x16/0x700 [test_kasan]
 do_one_initcall+0xa5/0x3ae
 do_init_module+0x1b6/0x547
 load_module+0x75df/0x8070
 __do_sys_init_module+0x1c6/0x200
 __x64_sys_init_module+0x6e/0xb0
 do_syscall_64+0x9f/0x2c0
 entry_SYSCALL_64_after_hwframe+0x44/0xa9
RIP: 0033:0x7f96443109da
RSP: 002b:00007ffcf0b51b08 EFLAGS: 00000202 ORIG_RAX: 00000000000000af
RAX: ffffffffffffffda RBX: 000055dc3ee521a0 RCX: 00007f96443109da
RDX: 00007f96445cff88 RSI: 0000000000057a50 RDI: 00007f9644992000
RBP: 000055dc3ee510b0 R08: 0000000000000003 R09: 0000000000000000
R10: 00007f964430cd0a R11: 0000000000000202 R12: 00007f96445cff88
R13: 000055dc3ee51090 R14: 0000000000000000 R15: 0000000000000000

Allocated by task 2760:
 save_stack+0x43/0xd0
 kasan_kmalloc+0xa7/0xd0
 kmem_cache_alloc_trace+0xe1/0x1b0
 kmalloc_oob_right+0x56/0xbc [test_kasan]
 kmalloc_tests_init+0x16/0x700 [test_kasan]
 do_one_initcall+0xa5/0x3ae
 do_init_module+0x1b6/0x547
 load_module+0x75df/0x8070
 __do_sys_init_module+0x1c6/0x200
 __x64_sys_init_module+0x6e/0xb0
 do_syscall_64+0x9f/0x2c0
 entry_SYSCALL_64_after_hwframe+0x44/0xa9

Freed by task 815:
 save_stack+0x43/0xd0
 __kasan_slab_free+0x135/0x190
 kasan_slab_free+0xe/0x10
 kfree+0x93/0x1a0
 umh_complete+0x6a/0xa0
 call_usermodehelper_exec_async+0x4c3/0x640
 ret_from_fork+0x35/0x40

The buggy address belongs to the object at ffff8801f44ec300
 which belongs to the cache kmalloc-128 of size 128
The buggy address is located 123 bytes inside of
 128-byte region [ffff8801f44ec300, ffff8801f44ec380)
The buggy address belongs to the page:
page:ffffea0007d13b00 count:1 mapcount:0 mapping:ffff8801f7001640 index:0x0
flags: 0x200000000000100(slab)
raw: 0200000000000100 ffffea0007d11dc0 0000001a0000001a ffff8801f7001640
raw: 0000000000000000 0000000080150015 00000001ffffffff 0000000000000000
page dumped because: kasan: bad access detected

Memory state around the buggy address:
 ffff8801f44ec200: fc fc fc fc fc fc fc fc fb fb fb fb fb fb fb fb
 ffff8801f44ec280: fb fb fb fb fb fb fb fb fc fc fc fc fc fc fc fc
>ffff8801f44ec300: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 03
                                                                ^
 ffff8801f44ec380: fc fc fc fc fc fc fc fc fb fb fb fb fb fb fb fb
 ffff8801f44ec400: fb fb fb fb fb fb fb fb fc fc fc fc fc fc fc fc
==================================================================
```

​	`BUG: KASAN:` 第一行报告了错误类型，slab-out-of-bounds；

​	`Call Trace`:表明了当前error的堆栈跟踪；

​	`Allocated by task 2760`:表明了所访问内存分配位置的堆栈跟踪（“where the accessed memory was allocated ”）；

​	`Freed by task 815`:表明了对象被释放的位置的堆栈跟踪（“where the object was freed”）；

​	`The buggy address belongs to ……`:表明了访问的slab对象的相关描述；

​	`Memory state around the buggy address:`表明了访问slab对象周围的内存情况。



### 5. 影子内存

​	KASAN的原理是利用“额外”的内存来标记那些可以被使用的内存的状态。这些做标记的区域被称为影子区域（shadow region）。了解 Linux 内存管理的读者知道，内存中的每个物理页在内存中都会有一个 struct page 这样的结构体来表示，即每 4KB 的页需要 40B 的结构体，大约 1% 的内存用来表示内存本身。Kasan 与其类似但“浪费”更为严重，影子区域的比例是 1:8，即总内存的九分之一会被“浪费”。用官方文档中的例子，如果有 128TB 的可用内存，需要有额外 16TB 的内存用来做标记。

![Shadow Memory of KASAN](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230504141838.png)

​	做标记的方法比较简单，将可用内存按照 8 子节的大小分组，如果每组中所有 8 个字节都可以访问，则影子内存中相应的地方用全零（0x00）表示；如果可用内存的前 N（1 到 7 范围之间）个字节可用，则影子内存中响应的位置用 N 表示；其它情况影子内存用负数表示该内存不可用（*KASAN使用不同的负值来区分不同类型的不可访问内存，如redzones 或已释放的内存，参见 mm/kasan/kasan.h*）。

​	上述Report中，箭头指向的影子字节`03`，表示访问的地址是部分可访问的。报告中可访问的内存是“00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 03”，一共15个`00`和一个`03`，其表明了一共有15×8+3=123个字节可以访问，当试图访问这123个字节之外的内容时，就会报错out-of-bounds。

​	**KASAN错误标题（如 `slab-out-of-bounds` 或 `use-after-free` ） 是尽量接近的KASAN根据其拥有的有限信息打印出最可能的错误类型。错误的实际类型 可能会有所不同。**



## Reference

- 文档：

  - [The Kernel Address Sanitizer (KASAN) — The Linux Kernel documentation](https://www.kernel.org/doc/html/latest/dev-tools/kasan.html)
  - [内核地址消毒剂(KASAN) — The Linux Kernel documentation](https://www.kernel.org/doc/html/latest/translations/zh_CN/dev-tools/kasan.html)
  - [Kasan - Linux 内核的内存检测工具 - 腾讯云开发者社区-腾讯云 (tencent.com)](https://cloud.tencent.com/developer/article/1518011)

- 内存分配:
  - [Linux 内核 | 内存管理——slab 分配器 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/358891862)
  - [(60条消息) Linux内存子系统——分配物理页面（alloc_pages）_绍兴小贵宁的博客-CSDN博客](https://blog.csdn.net/weixin_42262944/article/details/119853846)

  