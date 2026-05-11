---
date: 2024/04/04
title: (技术积累)Fuzzm Heap&Stack Instrumentation代码解析
author: Shaw
categories: Paper
tags: ["WASM"]
---

# Fuzzm Heap&Stack Instrumentation代码解析

## 1. instrument_with_heap_canary_check()

>**Source:** /fuzzm-project/wasm_instrumenter/src/canaries.rs
>
>**Functionality:** 对Wasm插入heap canary

### 1. dlmalloc(size)



#### 1.1 Prefix

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240404160059352.png)

- **插入内容：**

```wasm
 block  
      global.get $__disable_canary_insertion_in_malloc
      i32.const 1
      i32.eq
      br_if 0 
      local.get 0
      i32.const 20
      i32.add
      local.tee 12
      local.set 0
end
```

- **插入位置：**dlmalloc函数代码段开头。
- **解析：**

```wasm
 block  
      global.get $__disable_canary_insertion_in_malloc
      i32.const 1
      i32.eq
      br_if 0 
      ;;...
 end
```

这里在`dlmalloc`函数开头插入一个新的block，编号为block 0。Wasm中的`br`/`br_if`指令的功能是跳出目标block，故这里前几句的功能是判断`$__disable_canary_insertion_in_malloc`是否等予1，如果等于则直接跳过该块的插桩代码。

>$__disable_canary_insertion_in_malloc 在实际的Wasm指令中一般是最后一个globe的值。

```wasm
 block  
      ;;...
      br_if 0 
      local.get 0
      i32.const 20
      i32.add
      local.tee 12
      local.set 0
end
```

这里字面上的逻辑是将local 0的值加了20，并将这个值也存在local 12（最后一个local）中。在Wasm中函数的参数是存在局部变量中的，这里dlmalloc接受一个size参数用于表示需要分配的内存大小，故这里实际上是让dlmalloc分配size+20空间的内存，多出的20用于存储canary。

#### 1.2 Postfix

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240404160158226.png)

在原本函数结尾：

```wasm
global.set $__stack_pointer
local.get 0
```

这两句指令重新设置了栈帧，并将返回值（local 0）压栈。

插桩后的代码在这两句指令之后加入了如下指令：

```wasm
local.set 13
block (result i32) 
    local.get 13
    local.get 13
    i32.eqz
    br_if 0 
    global.get $__disable_canary_insertion_in_malloc
    i32.const 1
    i32.eq
    br_if 0 
    local.get 12
    i32.store align=1
    local.get 13
    i64.const 0
    i64.store offset=4 align=1
    local.get 12
    local.get 13
    i32.add
    i32.const 8
    i32.sub
    i64.const 0
    i64.store align=1
    local.get 13
    i32.const 12
    i32.add
end
```

首先，其使用`local.set 13`将栈上的返回值存储到了local 13中，然后在函数结尾插入了一个block。

在block中，首先进行了两次条件判断：

```wasm
block (result i32) 
    local.get 13
    local.get 13
    i32.eqz
    br_if 0 
    global.get $__disable_canary_insertion_in_malloc
    i32.const 1
    i32.eq
    br_if 0 
    ;;...
end
```

dlmalloc的返回值是已分配空间的首地址，这判断dlmalloc是否返回零(分配失败)并判断是否需要跳过canary，接着：

```wasm
block
	;;...
	local.get 12
    i32.store align=1
    local.get 13
    i64.const 0
    i64.store offset=4 align=1
    ;;...
end
```

第一句`local.get 12`之后当前的栈：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240404161531437.png" style="zoom:50%;" />

故接下来`i32.store align=1`将size+20存储到了分配好的空间的开头4字节，类似地，`i64.store offset=4 align=1`将0（i64，8字节）存储到了分配好的空间的第5-12个字节处，这里的0就是canary。

接下来：

```wasm
block
	//...
	local.get 12
    local.get 13
    i32.add
    i32.const 8
    i32.sub
    i64.const 0
    i64.store align=1
    local.get 13
    i32.const 12
    i32.add
end
```

这段代码将0(i64，8字节)存储到了已分配好的空间的倒数第=八个字节，并使函数返回已分配好的空间的首地址+12的地址。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240404170332204.png" style="zoom:67%;" />

### 2. dlfree(p)

free函数会在free操作之前检查canary的值。

#### 2.1 Prefix

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240404170558815.png" style="zoom:50%;" />

br判断的流程与上述相似，这里略（总的来说就是跳过$__disable_canary_insertion_in_malloc和返回值为Null的情况）。

检查第一个canary：

```wasm
block  ;; label = @3
    local.get 0
    i32.const 12
    i32.sub
    local.set 0 ;; 将指针指向return - 12，即dlmalloc原本分配的位置
    local.get 0
    i32.const 4
    i32.add
    i64.load align=1 // load canary 1
    i64.eqz ;; 检查是否为0
    br_if 0 (;@3;) 
    unreachable ;; 如果不为零则报错："RuntimeError: unreachable"
end
```

检查第二个canary:

```wasm
block  ;; label = @3
    local.get 0
    i32.load align=1 ;; size+20入栈
    local.get 0 
    i32.add
    i32.const 8
    i32.sub
    i64.load align=1 // load canary 2
    i64.eqz ;; 检查是否为0
    br_if 0 (;@3;)
    unreachable ;; 如果不为零则报错："RuntimeError: unreachable"
end
```

以上就是heap canary在fuzzm中的具体实现，作者在这里使用了简单的两个64位的0来作为canary。

>1. 如果有目的的构造溢出，这个canary可以被绕过（canary的部分覆盖为0即可）；
>2. 开头的4字节（size+20）如果被修改？
>3. 这个措施增加了多少性能损耗？
>4. 这个canary要求每个dlmalloc都对应一个dlfree，但在真实的代码中并不一定所有dlmalloc都会被主动释放。（可以学习rust的做法，每个函数或scope退出后主动添加free吗？）

## 2. instrument_with_heap_canary_check()

>**Source:** /fuzzm-project/wasm_instrumenter/src/canaries.rs
>
>**Functionality:** 对Wasm插入stack canary

### 2.1 哪些函数需要插桩？

```rust
fn requires_canary_check(f: &Function, stack_ptr: &Idx<Global>) -> bool {
    // emscripten adds the stackAlloc and stackRestore functions
    // that both break the invarint that the stack size prior to function
    // entrance is equal to the stack size after function exit.
    // The stackAlloc function is used to, for example, allocate space for argv
    // before the main function is called.
    let breaks_stack_invariant = is_stack_alloc(f, stack_ptr) || is_stack_restore(f, stack_ptr);
    // we check instr_count > 1 since all functions implicitly have an end instruction.
    f.instr_count() > 1 && !breaks_stack_invariant
    // possible other optimizations?
    // TODO check if f even uses the stack pointer.
}
```

Emscripten添加的`stackAlloc`和`stackRestore`函数并不遵循栈平衡原则，故作者排除了这两个函数或者指令数小于等于1的函数。

### 2.2 Prefix

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240404172847664.png)

对函数开头的插桩如下：

```wasm
(func func_name (type 0) (param i32 i32) (result i32)
	global.get $__stack_pointer
	i32.const 16
    i32.sub
    global.set $__stack_pointer ;; 函数栈帧增长16字节
    global.get $__stack_pointer
    i64.const $__random_number 
    i64.store align=1 ;; 在栈帧边缘插入8字节随机数
    block (result i32) ;; 将原本函数体包裹
    	;; func_body
    	br 0
    end
    
)
```

### 2.3 Postfix

对函数结尾插桩如下：

```wasm
(func func_name (type 0) (param i32 i32) (result i32)
	;;...
	block  
      global.get $__stack_pointer
      i64.load align=1
      i64.const $__random_number
      i64.eq ;; 比较栈帧边缘的值和随机数是否相等
      br_if 0 
      unreachable ;; 如果不相等则报错："RuntimeError: unreachable"
    end
    global.get $__stack_pointer
    i32.const 16
    i32.add
    global.set 0 ;; 将栈帧复原
)
```



## Reference

- Blogs:
  - [Introduction to WebAssembly components - radu's blog (radu-matei.com)](https://radu-matei.com/blog/intro-wasm-components/)
  - [Different Stacks of Wasm - HackMD](https://hackmd.io/@pepyakin/SkmPKGhiq)
  - [How to understand the "align" attribute in WebAssembly? - Stack Overflow](https://stackoverflow.com/questions/49345115/how-to-understand-the-align-attribute-in-webassembly)
  - [How to understand the "align" attribute in WebAssembly? - Stack Overflow](https://stackoverflow.com/questions/49345115/how-to-understand-the-align-attribute-in-webassembly)
- Github:
  - [Does local variables count include function arguments? · Issue #1037 · WebAssembly/design (github.com)](https://github.com/WebAssembly/design/issues/1037)
