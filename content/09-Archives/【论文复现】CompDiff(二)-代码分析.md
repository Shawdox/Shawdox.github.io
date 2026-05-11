---
date: 2023/07/31 15:29:55
title: (论文复现)CompDiff(二) 代码分析
author: Shaw
categories: Paper
tags: ["Fuzzing"]
---

​	CompDiff与AFL++源码对比分析。



## Code  analysis

​	CompDiff与AFL++源码对比分析。

### 1. 相关数据结构变化

#### 1.1 struct afl_state

​	在afl_state中， 相较于原本AFL++的数据结构，这里增加了一些变量用于处理多forserver。首先是增加了多forkserver数组`diff_srv`以及diff forkserver数量`diff_num`：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731102213.png)

​	增加了用于保存输出文件的指针`output_file`：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731102356.png)

​	增加了用于确定输出文件的`flag_use_output`：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731102540.png)

​	增加了用于对比输出文件差异的bitmap `virgin_diff`：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731102633.png)

​	增加了用于保存差异数量的`total_diffs`和`total_diffs`：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731102732.png)

​	

### 2. 主函数——afl-fuzz.c

> 简要分析CompDiff与AFL++中alf-fucc.c文件异同。

#### 2.1 afl_fsrv_init()

​	在main函数开头，原生forkserver完成初始化后，接着调用afl_fsrv_init()完成对另外10个待测试forkserver的初始化：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731094948.png)

​	在这之前，afl_state_init()函数会将`afl->diff_num`设置为10，然后CompDiff就会初始化diff_num个forkserver，该由于该部分forkserver用于后续的比较，故我们称这部分forkserver为<u>diff forkserver</u>。afl_fsrv_init()函数与AFL++无异。

#### 2.2 参数处理

​	在参数处理方面，CompDiff增加了`-y`与`-Y`选项:

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731110619.png)

- **-y选项：**

  -y选项用于指定diff forkserver的数量（如果不指定则默认为10），并将指定的参数存储于afl->diff_num中。

- **-Y选项：**

  -Y选项用于指定输出文件的存储位置，该位用于将待测试文件的输出到用户指定的文件中（AFL++默认丢弃fuzz target 的输出）。

  其设置了两个参数：`afl->output_file` = optarg、`afl->flag_use_output` = 1;

#### 2.3 设置kill-signal

​	在设置了主forkserver的kill signal后，将diff forkservers的kill signal设置为相同值：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731112112.png)

#### 2.4 设置fsrv.out_file

​	fsrv.out_file是需要传入fuzz target的参数，在设置完主forkserver的参数后，将diff forkserver的参数设置为相同的值：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731112328.png)

​	同时，增加了处理函数`setup_stdout_file_diff()`，其定义在diff-afl-fuzz-init.c中：

```c
void setup_stdout_file_diff(afl_state_t *afl) {
     
  // 如果指定了fuzz target输出文件
  if (afl->flag_use_output) {
       
    // 打印相关信息
    OKF("Using output...%s", afl->output_file);
       
    // 分配字符串空间
    u8* fn = alloc_printf("%s", afl->output_file);
    unlink(fn); /* Ignore errors */
       
    // 设置文件描述符
    afl->fsrv.dev_stdout_fd = open(fn, O_RDWR | O_CREAT | O_EXCL, 0600);
    if (afl->fsrv.dev_stdout_fd < 0) PFATAL("Unable to create '%s'", fn);
    ck_free(fn);
    
    // 分配错误文件信息
    fn = alloc_printf("%s/.error", afl->tmp_dir);
    unlink(fn); /* Ignore errors */
       
    // 设置文件描述符
    afl->fsrv.dev_stderr_fd = open(fn, O_RDWR | O_CREAT | O_EXCL, 0600);
    if (afl->fsrv.dev_stderr_fd < 0) PFATAL("Unable to create '%s'", fn);
    ck_free(fn);
  }
  // 设置每个forkserver的dev_stdout_fd
  for (int idx_com=0; idx_com < afl->diff_num; idx_com++) {
    u8* fn = alloc_printf("%s/.cur_output_%d", afl->tmp_dir, idx_com);
    unlink(fn); /* Ignore errors */
    afl->diff_fsrv[idx_com].dev_stdout_fd = open(fn, O_RDWR | O_CREAT | O_EXCL, 0600);
    if (afl->diff_fsrv[idx_com].dev_stdout_fd < 0) PFATAL("Unable to create '%s'", fn);
    ck_free(fn);
  }
  // 设置每个forkserver的dev_stderr_fd
  for (int idx_com=0; idx_com < afl->diff_num; idx_com++) {
    u8* fn = alloc_printf("%s/.cur_error_%d", afl->tmp_dir, idx_com);
    unlink(fn); /* Ignore errors */
    afl->diff_fsrv[idx_com].dev_stderr_fd = open(fn, O_RDWR | O_CREAT | O_EXCL, 0600);
    if (afl->diff_fsrv[idx_com].dev_stderr_fd < 0) PFATAL("Unable to create '%s'", fn);
    ck_free(fn);
  }
}
```

#### 2.5 shmem

​	在AFL中，`afl->shmem_testcase_mode`默认被置为1，setup_testcase_shmem()函数会为afl->shm_fuzz分配空间，并设置：

```c
afl->fsrv.support_shmem_fuzz = 1;
afl->fsrv.shmem_fuzz_len = (u32 *)map;
afl->fsrv.shmem_fuzz = map + sizeof(u32);
```

​	CompDiff在这之后会将diff forkserver的这三个参数设置为主forkserver相同的值：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731113845.png)

​	然后对所有forkserver进行共享内存的初始化，配置相关环境变量：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731114400.png)

#### 2.6 forkserver

​	在AFL中，其会调用afl_fsrv_get_mapsize()函数来启动一个forkserver，这里会接着将剩下的diff forkserver也启动：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731114819.png)

​	最后，将afl->virgin_diff通过memset函数置为0即可：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731144910.png)

​	以上就是afl-fuzz.c主文件中的大部分改动（还有部分细节见源码）。



### 3. 初始化

>afl-fuzz-init.c文件是AFL的初始化相关函数定义，这里描述了CompDiff与AFL++初始化方面的区别

#### 3.1 In afl-fuzz-init.c

##### 3.1.1 setup_dirs_fds()

​	setup_dirs_fds()函数用于创建输出目录以及其相关子目录（例如queue、crashes、hang等），并将`afl->fsrv.out_dir_fd`，`afl->fsrv.dev_null_fd`，`afl->fsrv.dev_urandom_fd` 设置为对应的描述符。

​	这里CompDiff在创建文件夹时，增加了对`diffs`文件夹的创建，其用于存储找到的discrepancy：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731153108.png)

​	接下来在往afl->fsrv.plot_file中写入字符串时加入unique_diffs信息：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731153230.png)



##### 3.1.2 check_binary()

​	check_binary()函数的主要作用是将fsrv.target_path设置为argv[optind]，也就是fuzz target的路径。这里增加了设置diff forkserver的相关代码：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731153815.png)

​	可以看到，这里需要对比运行的二进制文件的名称必须是`filename`+`-`+`diff_num`格式，故在实验复现阶段生成的文件名称是不能随意改变的。



#### 3.2 In afl-fuzz-state.c

##### 3.2.1 afl_state_init()

​	afl_state_init()函数的定义存储于afl-fuzz-state.c，相较于AFL++，CompDiff新增了：对virgin_diff图的空间分配、对diff forkserver的相关数据结构的初始赋值：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731185057.png)

##### 3.2.2 afl_state_deinit()

​	afl_state_deinit()函数用于移除并释放afl_state结构，这里增加了对diff相关数据结构的释放操作：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230731185557.png)

### 4. :star:DiffComp比较-核心逻辑

​	DiffComp的核心逻辑存储在diff-afl-fuzz-init.c中，其关键比较函数存储在differential_compilers()函数中：

```c
// from diff-afl-fuzz-init.c
// 比较不同输出
u8 differential_compilers(afl_state_t *afl, void *mem, u32 len) {
  unsigned char first_cksum_out[MD5_DIGEST_LENGTH], cksum_out[MD5_DIGEST_LENGTH];

  int bytes;
  unsigned char data[1024];

  u8 keep_as_diff = 0;
  fsrv_run_result_t ret;

  // 如果使用了-Y选项，指定输出文件
  if (afl->flag_use_output) {
    // 设置diff forkserver的相关描述符
    for (int idx = 0; idx < afl->diff_num; idx++) {
      afl->diff_fsrv[idx].dev_stdout_fd = afl->fsrv.dev_stdout_fd;
      afl->diff_fsrv[idx].dev_stderr_fd = afl->fsrv.dev_stderr_fd;
    }
  }

  for (int idx = 0; idx < afl->diff_num; idx++) {
    // 将这两个描述符置于文件开头
    lseek(afl->diff_fsrv[idx].dev_stdout_fd, 0, SEEK_SET);
    lseek(afl->diff_fsrv[idx].dev_stderr_fd, 0, SEEK_SET);

    // 清空文件内容
    if (ftruncate(afl->diff_fsrv[idx].dev_stdout_fd, 0)) PFATAL("ftruncate() failed");
    if (ftruncate(afl->diff_fsrv[idx].dev_stderr_fd, 0)) PFATAL("ftruncate() failed");

    // 将这两个描述符置于文件开头
    lseek(afl->diff_fsrv[idx].dev_stdout_fd, 0, SEEK_SET);
    lseek(afl->diff_fsrv[idx].dev_stderr_fd, 0, SEEK_SET);
  }

  // 将第一个diff forkserver的out_fd置于开头
  // out_fd用于指向fsrv->out_file
  // 也就是传给fuzz target的参数
  lseek(afl->diff_fsrv[0].out_fd, 0, SEEK_SET);

  // 运行第一个diff forkserver
  ret = afl_fsrv_run_target(&afl->diff_fsrv[0], afl->fsrv.exec_tmout, &afl->stop_soon);

  // 如果超时则退出
  if (ret == FSRV_RUN_TMOUT) {
    return ret;
  }

  // 将这两个描述符置于文件开头
  lseek(afl->diff_fsrv[0].dev_stdout_fd, 0, SEEK_SET);
  lseek(afl->diff_fsrv[0].dev_stderr_fd, 0, SEEK_SET);

  // md5 of first output
  MD5_CTX first_mdContext;
  MD5_Init (&first_mdContext);

  // 从第一个diff forkserver中读取1024个标准输出
  while ((bytes = read(afl->diff_fsrv[0].dev_stdout_fd, data, 1024)) != 0) {
    MD5_Update(&first_mdContext, data, bytes);
  }
  // 第一个diff forkserver中读取1024个错误输出
  while ((bytes = read(afl->diff_fsrv[0].dev_stderr_fd, data, 1024)) != 0) {
    MD5_Update(&first_mdContext, data, bytes);
  }
  // 计算输出的哈希值
  MD5_Final(first_cksum_out, &first_mdContext);
  
  // md5 of following outputs
  // 运行剩下的diff forkservers
  // 从dev_stdout_fd读取其输出并计算哈希
  for (int idx = 1; idx < afl->diff_num; idx++) {
    lseek(afl->diff_fsrv[0].out_fd, 0, SEEK_SET);
    ret = afl_fsrv_run_target(&afl->diff_fsrv[idx], afl->fsrv.exec_tmout, &afl->stop_soon);
    if (ret == FSRV_RUN_TMOUT) {
      return ret;
    } 
    lseek(afl->diff_fsrv[idx].dev_stdout_fd, 0, SEEK_SET);
    lseek(afl->diff_fsrv[idx].dev_stderr_fd, 0, SEEK_SET);

    MD5_CTX mdContext;
    MD5_Init (&mdContext);
    while ((bytes = read(afl->diff_fsrv[idx].dev_stdout_fd, data, 1024)) != 0){
      MD5_Update(&mdContext, data, bytes);
    }
    while ((bytes = read(afl->diff_fsrv[idx].dev_stderr_fd, data, 1024)) != 0){
      MD5_Update(&mdContext, data, bytes);
    }
    MD5_Final(cksum_out, &mdContext);

    // 与第一次计算的哈希比较
    // 如果不同则退出/继续比较
    if (strncmp(cksum_out, first_cksum_out, MD5_DIGEST_LENGTH) != 0) {
      keep_as_diff = 1; 
      //break;
    }
  }

  // 如果发现discrepancy
  if (keep_as_diff) {
    ++afl->total_diffs;
    classify_counts(&afl->fsrv);
    simplify_trace(afl, afl->fsrv.trace_bits);

    // 检查virgin_diff 图是否有变化
    if (!has_new_bits(afl, afl->virgin_diff)) { return 0; }

    u8 fn[PATH_MAX];
    s32 fd;

// 存储相关样例
#ifndef SIMPLE_FILES
      snprintf(fn, PATH_MAX, "%s/diffs/id:%06llu,sig:%02u,%s", afl->out_dir,
               afl->unique_diffs, afl->fsrv.last_kill_signal,
               describe_op(afl, 0, NAME_MAX - strlen("id:000000,sig:00,")));
#else
      snprintf(fn, PATH_MAX, "%s/diffs/id_%06llu_%02u", afl->out_dir,
               afl->unique_diffs, afl->last_kill_signal);
#endif                                                    /* ^!SIMPLE_FILES */
    fd = open(fn, O_WRONLY | O_CREAT | O_EXCL, DEFAULT_PERMISSION);
    if (unlikely(fd < 0)) { PFATAL("Unable to create '%s'", fn); }
    ck_write(fd, mem, len, fn);
    close(fd);
    ++afl->unique_diffs;
  }
  return 0;
}
```

​	differential_compilers()会在afl-fuzz-run.c中的common_fuzz_stuff()函数中被调用。
