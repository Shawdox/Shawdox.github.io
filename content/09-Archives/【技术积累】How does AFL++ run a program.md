---
date: 2023/07/23 15:14:56
title: (技术积累)How does AFL++ run a program?
author: Shaw
categories: Paper
tags: ["Fuzzing"]
---

## (技术积累)How does AFL++ run a program?

>前提：使用AFL++对开源程序fuzzing。

​	当对目标程序插桩完毕后，在一次运行中AFL++：

>- 如何准备运行的环境？
>- 如何获得程序的输入\输出？
>- 如何判断程序是否崩溃/对应sanitizer是否触发？
>- 如何获取这一次的代码覆盖率并记录结果？



## Using child process

​	使用Fuzzing最简单的思想就是调用execve()函数，其会加载新的子进程来运行指定的程序，设置好对应的运行环境。但这么做的问题是每次运行大部分的时间都在等待execve()加载环境、载入目标文件和库、解析符号地址等重复性工作上，这种重复的操作并不会为fuzzing带来好处，反而严重增加了成本。

​	AFL中使用了一种巧妙的手段来避免引入execve()导致的时间成本增加，其通过代码插桩与fork结合的方式，让程序停留在合适的位置以将算力聚焦于非重复操作上。

### 1. Some functions

- **exec** 

  在Linux中，并不存在一个exec()的函数形式，exec指的是一组函数，一共有6个，分别是：<u>execl、execlp、execle、execv、execvp、execve</u>。**execve()**（执行文件）在父进程中fork一个子进程，在子进程中调用exec函数启动新的程序。

- **fork()**

  fork系统调用用于创建一个新进程，称为**子进程**，它与进程（称为系统调用fork的进程）同时运行，此进程称为**父进程**。创建新的子进程后，两个进程将执行fork（）系统调用之后的下一条指令。子进程使用相同的pc，相同的CPU寄存器，在父进程中使用的相同打开文件。

  **二者区别如下：**

  <img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230723155221.png" style="zoom: 50%;" />
  
- **struct sigaction**

  - **signal**()

    >```C
    >void (*signal(int sig, void (*func)(int)))(int)
    >```
    >
    >**参数：**
    >
    >- **sig：**信号码，有以下几种：
    >
    >|   宏    |                             信号                             |
    >| :-----: | :----------------------------------------------------------: |
    >| SIGABRT |                (Signal Abort) 程序异常终止。                 |
    >| SIGFPE  | (Signal Floating-Point Exception) 算术运算出错，如除数为 0 或溢出（不一定是浮点运算）。 |
    >| SIGILL  | (Signal Illegal Instruction) 非法函数映象，如非法指令，通常是由于代码中的某个变体或者尝试执行数据导致的。 |
    >| SIGINT  |   (Signal Interrupt) 中断信号，如 ctrl-C，通常由用户生成。   |
    >| SIGSEGV | (Signal Segmentation Violation) 非法访问存储器，如访问不存在的内存单元。 |
    >| SIGTERM |       (Signal Terminate) 发送给本程序的终止请求信号。        |
    >
    >- func：信号处理函数指针，可以用预定义的SIG_IGN（忽略）、SIG_DFL（系统默认）、SIG_ERR（返回错误）

  - **sigaction**()

    >```c
    >int sigaction(int signum, const struct sigaction *act,struct sigaction *oldact)
    >```
    >
    >**参数：**
    >
    >- **signum：**要捕获的信号
    >- **act：**接收到信号之后对信号进行处理的结构体
    >- **oldact：**接收到信号之后，保存原来对此信号处理的各种方式与信号（可用来做备份）。如果不需要备份，此处可以填NULL
    >
    >**返回值：**
    >
    >- **成功时：**返回0
    >- **出错时：**返回-1，并将errno设置为指示错误

  - struct sigaction

    >```c
    >struct sigaction{
    >void(*sa_handler)(int);// 旧的信号处理函数
    >void(*sa_sigaction)(int,siginfo_t *,void *);// 新的信号处理函数
    >sigset_t  sa_mask;// 信号阻塞集
    >int       sa_flags;// 信号的处理方式
    >void(*sa_restorer)(void);// 己弃用
    >}
    >```
    >
    >- **sa_handler,sa_sigaction：** 信号处量函数指针，和signal()里的函数指针用法一样，应根据sa_sigaction, sa_handler 两者之一赋值，其取值如：SIG_IGN  忽略该信号、SIG_DEL  执行系统默认动作；
    >- **sa_mask：**  信号阻塞集，在信号处理函数执行过程中，临时屏蔽指定信号；
    >- **sa_flags：** 用于指定信号处理的行为，通常设为0，表默认属性，它可以是以下值的按位与组合



### 2. Fuzzing without execve()

​	AFL的思路是：

- **通过对程序插桩，让程序在合适的位置停下等待fuzzer的指令**

  - 这时程序所需的运行环境已经加载完毕，但没有开始获取输入；
  - 指定环境变量`LD_BIND_NOW`=1，当LD_BIND_NOW被设置为非空值时，动态链接器会在程序启动时立即解析所有的符号。<u>这意味着符号解析工作不会延迟到实际用到该符号的时候，而是在程序加载时就会完成</u>：

  ```c
  // from afl-forkserver.c
  
  /* This should improve performance a bit, since it stops the linker from
         doing extra work post-fork(). */
  if (!getenv("LD_BIND_LAZY")) { setenv("LD_BIND_NOW", "1", 1); }
  ```

  - 相反，如果没有设置`LD_BIND_NOW`环境变量，动态链接器会使用lazy binding的方式进行符号解析。lazy binding是一种延迟符号解析的机制，在实际使用到某个符号时再进行解析和绑定，这样可以节省程序启动时的时间和资源开销；
  - 这个合适的位置通常是待测程序的main函数。

- **当收到fuzzer的相关执行指令后，使用fork()创建子进程**

  - fork()会对已经加载完成的程序创建完全相同的子进程副本，由子进程运行程序；
  - 得益于“copy-on-write”写时复制机制，对进程的复制是很快并且隔离性很好；

- **在父进程中，会将新加入进程的 PID 转发给fuzzer，然后返回命令等待循环**

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230723164724.png" style="zoom:67%;" />

​	当开启`persistent mode`后，AFL++ 会在单个fork进程中对目标进行多次fuzzing测试，而不是为每次执行都分叉一个新进程。这是最有效的模糊方法，因为速度可以轻松快 10 倍或 20 倍，而没有任何缺点，所有专业的fuzzing都会使用这种模式。



### 3. Deep into the code

##### 3.1 AFL++的主体是`afl-fuzz.c`，关于forkserver，其负责的功能有：

1. 在main函数的开头初始化forkserver：

```c
afl_fsrv_init(&afl->fsrv);
```

​	  该函数对fsrv数据结构中的相关值进行了初始化。

2. 启动一个forkserver：

   首先，运行fuzz时会使用如下命令行参数：

```bash
alf-fuzz -i input_dir -o output_dir -- ./to_be_test @@
```

​	在while循环中使用getopt()函数读取命令行参数后，(argv+optind)指针会指向`./to_be_test`。后续的代码会将afl->fsrv.target_path设置为`argv[optind]`，然后从input_dir读取完test case后运行：

```c
//from afl.fuzz.c
// afl_fsrv_get_mapsize()函数会start一个forkserver
// 然后返回这个forkserver的fsrv->map_size属性
u32 new_map_size = afl_fsrv_get_mapsize(
     &afl->fsrv, afl->argv, &afl->stop_soon, afl->afl_env.afl_debug_child);
```

​	afl_fsrv_get_mapsize()函数会首先调用afl_fsrv_start()，启动一个forkserver：

```c
//from afl.fuzz.c
afl_fsrv_start(&afl->fsrv, afl->argv, &afl->stop_soon, afl->afl_env.afl_debug_child);
```

​	该函数会检查相关管道设置，重定向进程的0、1、2号文件描述符，然后fork一个进程，然后这个进程execv targetBinary ，targetBinary中也启动的了fork（），相当于fuzzer程序是实际被fork程序的祖祖父进程。

![forkserver设计](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230725142813.png)

##### 3.2 在`forkserver.h`与`forkserver.c`文件中，其定义了相关数据结构`afl_forkserver`：

​	forkserver的关键函数是afl_fsrv_start()：

```c
// 设置状态管道st_pipe和控制管道ctl_pipe
if (pipe(st_pipe) || pipe(ctl_pipe)) { PFATAL("pipe() failed"); }
//last_run_timed_out 为 u32，以 4 字节数组的形式发送给子进程
fsrv->last_run_timed_out = 0;
// fork出一个子进程
fsrv->fsrv_pid = fork();
// 若fork成功，则父进程即为fuzzer
// 子进程即为目标程序进程，也就是fork server
if (fsrv->fsrv_pid < 0) { PFATAL("fork() failed"); }
if (!fsrv->fsrv_pid) {
     // 子进程
     // ......
}
// 父进程
// 若fuzzer从server中读取了四个字节的hello ，
// 那么forkserver程序就设置成功了，如果没有，
// 接下来的代码就是检查错误。
if (rlen == 4) {//判断读取是否成功
    OKF("All right - fork server is up.");
    return;
}
```

###### 3.2.1 子进程—>forkserver

​	可以看到，这里fork了一个进程，在子进程中，首先设置该进程对SIGPIPE的处理方式：

```c
// enable terminating on sigpipe in the childs
// 当一个进程试图向已关闭的管道写入数据时，操作系统会发送SIGPIPE信号给该进程。
struct sigaction sa;
memset((char *)&sa, 0, sizeof(sa));
sa.sa_handler = SIG_DFL;
sigaction(SIGPIPE, &sa, NULL);
```

​	然后进行一些诸如内存、文件描述符之类的资源设置后（这里略）。<u>**在完成相关管道、文件描述符的配置后，afl_fsrv_start()函数会在子进程内使用setsid()函数使子进程独立，然后在子进程内直接运行待测试程序**</u>:

```c
/* Isolate the process and configure standard descriptors. If out_file is
   specified, stdin is /dev/null; otherwise, out_fd is cloned instead. */
// 创建一个守护进程
setsid();

if (!(debug_child_output)) {
     // 如果没有指定debug_child_output，则
     // 重定向文件描述符1和2到dev_null_fd
     // 因为dev_null_fd=-1，子进程将不输出
     dup2(fsrv->dev_null_fd, 1);
     dup2(fsrv->dev_null_fd, 2);
}

// 如果指定了out_file，则文件描述符0重定向到dev_null_fd，否则重定向到out_fd
if (!fsrv->use_stdin) {
     dup2(fsrv->dev_null_fd, 0);
} else {
     dup2(fsrv->out_fd, 0);
     close(fsrv->out_fd);
}
```

​	设置管道，并关闭一些不必要的管道和文件描述符：

```c
// 设置控制和状态管道，关闭一些不需要的文件描述符
// FORKSRV_FD = 198
// 198号fd用于ctl管道读操作
// 199号fd用于st管道写操作
if (dup2(ctl_pipe[0], FORKSRV_FD) < 0) { PFATAL("dup2() failed"); }
if (dup2(st_pipe[1], FORKSRV_FD + 1) < 0) { PFATAL("dup2() failed"); }

close(ctl_pipe[0]);
close(ctl_pipe[1]); 
close(st_pipe[0]);
close(st_pipe[1]);

close(fsrv->out_dir_fd);
close(fsrv->dev_null_fd);
close(fsrv->dev_urandom_fd);
```

​	如果`LD_BIND_LAZY`不为1则设置为1（原因参考上文）：

```c
if (!getenv("LD_BIND_LAZY")) { setenv("LD_BIND_NOW", "1", 1); }
```

​	然后使用execv运行程序：

```c
// init_child_func == fsrv_exec_child
fsrv->init_child_func(fsrv, argv);

/* Use a distinctive bitmap signature to tell the parent about execv()
       falling through. */
// 运行失败这段代码就会执行
// 运行成功则不会
*(u32 *)fsrv->trace_bits = EXEC_FAIL_SIG;
FATAL("Error: execv to target failed\n");
```

​	`init_child_func`定义如下：

```c
static void fsrv_exec_child(afl_forkserver_t *fsrv, char **argv) {
  if (fsrv->qemu_mode || fsrv->cs_mode) {
    setenv("AFL_DISABLE_LLVM_INSTRUMENTATION", "1", 0);
  }
  // 运行target_path处的程序
  execv(fsrv->target_path, argv);
  WARNF("Execv failed in forkserver.");
}
```

​	`fsrv.target_path`就是要fuzz的程序的地址，其经过check_binary()函数初始化。

###### 3.2.2 父进程—>fuzzer

​	父进程会设置相关管道，并使用read_s32_timed()函数从子进程中读取信息，同时进行相关超时处理：

```c
/* Wrapper for select() and read(), reading a 32 bit var.
  Returns the time passed to read.
  If the wait times out, returns timeout_ms + 1;
  Returns 0 if an error occurred (fd closed, signal, ...); */
static u32 __attribute__((hot))
read_s32_timed(s32 fd, s32 *buf, u32 timeout_ms, volatile u8 *stop_soon_p) {	
  // 配置相关变量
  // ......
  // set exceptfds as well to return when a child exited/closed the pipe. 
restart_select:
  // 使用select函数阻塞进程，从readfds中读取信息
  sret = select(fd + 1, &readfds, NULL, NULL, &timeout);
  if (likely(sret > 0)) {
  restart_read:
    if (*stop_soon_p) {
      // Early return - the user wants to quit.
      return 0;
    }
    len_read = read(fd, (u8 *)buf, 4);
    
    // ......
       
    if (likely(len_read == 4)) {  // for speed we put this first
      // ensure to report 1 ms has passed (0 is an error)
      return exec_ms > 0 ? exec_ms : 1;
    } else if (unlikely(len_read == -1 && errno == EINTR)) {
      goto restart_read;
    } else if (unlikely(len_read < 4)) {
      return 0;
    }
  } else if (unlikely(!sret)) {
    *buf = -1;
    return timeout_ms + 1;
  } else if (unlikely(sret < 0)) {
    if (likely(errno == EINTR)) goto restart_select;
    *buf = -1;
    return 0;
  }
  return 0;  // not reached
}
```

​	可以看到，如果返回0代表出错，返回timeout_ms + 1代表超时。

​	接着判断从子进程读取到的信息的长度，如果读取到4字节的hello信息则代表forkserver初始化成功，<u>**父进程函数直接返回，继续执行fuzzer**</u>，子进程保留运行等待fuzzer指令：

```c
if (rlen == 4) {
	// 错误/超时处理
      if ((status & FS_OPT_ERROR) == FS_OPT_ERROR)
      report_error_and_exit(FS_OPT_GET_ERROR(status)){
           //......
      }
	if ((status & FS_OPT_ENABLED) == FS_OPT_ENABLED){
          //......
     }
     // 如果forkserver初始化成功，直接退出父函数
     // 因为子进程里设置了setsid，故其仍然继续运行
     return;
}
if (fsrv-last_run_time_out){
     // 读取超时处理
}
// 相关错误处理
// ......
```

​	注意到，forkserver与待测试程序之间的关系并不是两个独立的程序，**<u>forkserver是经过代码插桩以后的待测试程序</u>**，其可以在相关符号加载完成后等待fuzzer的指令，然后在循环中不断fork执行程序。

##### 3.3 代码插桩

​	当forkserver初始化后，由于使用execv直接运行待测试程序，按理来说其应该直接执行，并不会有forkserver的功能。但在程序编译时进行了代码插桩，execv后的子进程其会在main函数停止，等待fuzzer的命令，具体的插桩分析见Reference:star:。



## Get the input/output



## Dry run

​	在将test case从input dir读取到afl->queue中后，进行正式的fuzzing之前，AFL通会对所有的test cases进行一次执行，以确保排除一些古怪的、有问题的test case，AFL源码中管这个过程叫`Calibrate`。**对input_dir进行Calibrate的过程就是dry run。**

​	PS：可以通过设置环境变量`AFL_NO_STARTUP_CALIBRATION`来决定是否进行dry run。

### 1. perform_dry_run()

>**函数原型：**  void* perform_dry_run(*afl_state_t* **afl*) 
>
>**来源：**afl-fuzz-init.c
>
>**被引用：**afl-fuzz.c
>
>**功能简介：**对所有的测试用例进行模拟运行，以确保应用程序按预期执行。

​	首先，perform_dry_run()函数会遍历afl->queue_buf，每个queue_buf中存储着input相关信息。函数打开input文件，将其读取到一块内存use_mem中，然后调用calibrate_case()函数运行单个测试用例：

```c
// 获取文件名
u8 *fn = strrchr(q->fname, '/') + 1;

// 打印文件名
ACTF("Attempting dry run with '%s'...", fn);

// 只读打开文件
fd = open(q->fname, O_RDONLY);
if (fd < 0) { PFATAL("Unable to open '%s'", q->fname); }

// 将文件读取到use_mem中
u32 read_len = MIN(q->len, (u32)MAX_FILE);
use_mem = afl_realloc(AFL_BUF_PARAM(in), read_len);
ck_read(fd, use_mem, read_len, q->fname);

// 关闭文件
close(fd);

// 运行case
res = calibrate_case(afl, q, use_mem, 0, 1);
```

​	在通过运行calibrate_case()函数对单个输入进行测试后，通过其返回的res对不同的结果进行处理：

```c
switch (res) {
	case FSRV_RUN_OK:
	case FSRV_RUN_TMOUT:
	case FSRV_RUN_CRASH:
	case FSRV_RUN_ERROR:
	case FSRV_RUN_NOINST:
	case FSRV_RUN_NOBITS:
}
```

​	总体函数调用逻辑如下：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230729162022.png" style="zoom: 67%;" />

### 2. :star:calibrate_case()

>**函数原型：**  u8 calibrate_case(*afl_state_t* *afl, *struct* queue_entry *q, u8 *use_mem, u32 handicap, u8 from_queue) 
>
>**来源：**afl-fuzz-run.c
>
>**被引用：**afl-fuzz-init.c
>
>**功能简介：**运行单个测试用例，排除有问题的样例。

​	这个函数是AFL的重点函数之一，在`perform_dry_run`，`save_if_interesting`，`fuzz_one`，`pilot_fuzzing,core_fuzzing`函数中均有调用。

​	开始时，函数会设置两个属性，`afl->stage_name`用以表示程序正处在calibration阶段，`afl->stage_max`是每一个测试样例需要运行的次数，如果设置了CAL_CYCLES_FAST，则为3，否则默认情况下为8。

```c
afl->stage_name = "calibration";
afl->stage_max = afl->afl_env.afl_cal_fast ? CAL_CYCLES_FAST : CAL_CYCLES;
```

​	接着，根据`afl->stage_max`开启一个for循环：

```c
// 每个运行stage_max次
for (afl->stage_cur = 0; afl->stage_cur < afl->stage_max; ++afl->stage_cur) {
	u64 cksum;
	// 将testcase写入到文件中去
    	(void)write_to_testcase(afl, (void **)&use_mem, q->len, 1);
     // 运行样例
    	fault = fuzz_run_target(afl, &afl->fsrv, use_tmout);
     
     // ......
     
     // 通过trace_bits计算checksum
     cksum = hash64(afl->fsrv.trace_bits, afl->fsrv.map_size, HASH_CONST);
     if (q->exec_cksum != cksum) {

      // 对比queue中的checksum和forkserver中的checksum
      // 如果发现不同，则调用has_new_bits()函数和总表virgin_bits对比
      hnb = has_new_bits(afl, afl->virgin_bits);
      if (hnb > new_bits) { new_bits = hnb; }
      // 如果q->exec_cksum不为0，说明不是第一次执行
      // 后面运行的时候如果，和前面第一次trace_bits结果不同，则需要多运行几次
      if (q->exec_cksum) {

        u32 i;
        for (i = 0; i < afl->fsrv.map_size; ++i) {
          if (unlikely(!afl->var_bytes[i]) &&
              unlikely(afl->first_trace[i] != afl->fsrv.trace_bits[i])) {

            afl->var_bytes[i] = 1;
            // ignore the variable edge by setting it to fully discovered
            afl->virgin_bits[i] = 0;
          }
        }
       	// ......
        }
        var_detected = 1;
        afl->stage_max =
            afl->afl_env.afl_cal_fast ? CAL_CYCLES : CAL_CYCLES_LONG;
      } else {
        // 更新cksum和trace
        q->exec_cksum = cksum;
        memcpy(afl->first_trace, afl->fsrv.trace_bits, afl->fsrv.map_size);

      }
    }
}// end for for-loop
```

​	在每个循环中，调用write_to_testcase()函数将修改后的数据写入文件进行测试。然后通过hash64()函数校验此次运行的trace_bits，检查是否出现新的情况。

​	最后，调用`update_bitmap_score()` 对这个测试用例的每一个byte进行排序，用一个top_rate[]来维护它的最佳入口。然后进行一些后续处理。

### 3.write_to_testcase()

>**函数原型：**u32 __ attribute __((hot)) write_to_testcase(*afl_state_t* *afl , void **mem, u32 len, u32 fix) 
>
>**来源：**afl-fuzz-run.c
>
>**被引用：**afl-fuzz-run.c
>
>**功能简介：**将testcase写入到文件中去

​	write_to_testcase()在检查相关参数合理性后，调用 afl_fsrv_write_to_testcase()函数，要么将mem的内容写入`fsrv->shmem_fuzz`中，要么写入`fsrv->out_fd`中。



### 4. :star:fuzz_run_target()

>**函数原型：**fsrv_run_result_t __ attribute __((hot)) fuzz_run_target(afl_state_t *afl, afl_forkserver_t *fsrv, u32 timeout) 
>
>**来源：**afl-fuzz-run.c
>
>**被引用：**afl-fuzz-run.c
>
>**功能简介：** 运行目标待测试程序

​	fuzz_run_target()函数用于执行目标应用程序、监控超时、返回状态信息，被调用的程序将更新trace_bits[]。<u>其直接调用afl_fsrv_run_target(fsrv, timeout, &afl->stop_soon)函数。</u>

​	在afl_fsrv_run_target()中，运行程序的主要思路是通过管道向子进程写入控制信息，通知子进程开始fuzzing:

```c
// 将fsrv->last_run_timed_out通过控制管道写入
if ((res = write(fsrv->fsrv_ctl_fd, &write_value, 4)) != 4) {
     if (*stop_soon_p) { return 0; }
     RPFATAL(res, "Unable to request new process from fork server (OOM?)");
}

// 重新清空fsrv->last_run_timed_out
fsrv->last_run_timed_out = 0;

// 从forkserver读取子进程的pid
if ((res = read(fsrv->fsrv_st_fd, &fsrv->child_pid, 4)) != 4) {
     if (*stop_soon_p) { return 0; }
     RPFATAL(res, "Unable to request new process from fork server (OOM?)");
}
```

​	然后，其会调用read_s32_timed()函数阻塞进程，等待子进程返回信息：

```c
// 阻塞父进程，从forkserver中读取信息
exec_ms = read_s32_timed(fsrv->fsrv_st_fd, &fsrv->child_status, timeout,
                         stop_soon_p);
// 超时 & 错误 & crash处理
// ......
```

## Main loop

​	主循环是AFL++的核心流程，其行使了完整的fuzzing流程。

​	![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230729170359.png)

## Reference

- Forkserver of AFL:
  - [More about AFL — AFL 2.53b documentation (afl-1.readthedocs.io)](https://afl-1.readthedocs.io/en/latest/about_afl.html?highlight=fork#the-fork-server)
  - [lcamtuf's old blog: Fuzzing random programs without execve()](https://lcamtuf.blogspot.com/2014/10/fuzzing-binaries-without-execve.html)
  - [AFL-Unicorn中的fork server机制详解 CSDN博客](https://blog.csdn.net/Little_Bro/article/details/122694054)
  - [AFLplusplus/docs/env_variables.md at 7f17a94349830a54d2c899f56b149c0d7f9ffb9c · AFLplusplus/AFLplusplus (github.com)](https://github.com/AFLplusplus/AFLplusplus/blob/7f17a94349830a54d2c899f56b149c0d7f9ffb9c/docs/env_variables.md)
  - :star:[[原创\]AFL afl_fuzz.c 详细分析-二进制漏洞-看雪-安全社区|安全招聘|kanxue.com](https://bbs.kanxue.com/thread-254705.htm)
  - :star:[AFL内部实现细节小记 - 记事本 (rk700.github.io)](https://rk700.github.io/2017/12/28/afl-internals/)
- System process：
  - [wait 和 waitpid 详解及代码示例_-CSDN博客](https://blog.csdn.net/lqy971966/article/details/110818165)
  - [fork（函数）_百度百科 (baidu.com)](https://baike.baidu.com/item/fork/7143171?fromModule=lemma_inlink)
  - [fork和execve和Linux内核的一般执行过程 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/148127537)
  - [LINUX信号处理（sigaction信号捕获函数：struct sigaction）CSDN博客](https://blog.csdn.net/qq_20853741/article/details/113547906)
  - [select函数及fd_set介绍 - 博客园 ](https://www.cnblogs.com/wuyepeng/p/9745573.html)
  - [Linux signal()和kill()_CSDN博客](https://blog.csdn.net/qq_44198589/article/details/110206494)
- C/C++:
  - [ C/C++ 命令解析：getopt 方法详解和使用示例_CSDN博客](https://blog.csdn.net/afei__/article/details/81261879)
  - [linux c解析命令行选项getopt、optarg、optind、opterr、optopt - 戴磊笔记 (daileinote.com)](http://www.daileinote.com/computer/c_base/14)
  - [Linux access函数讲解_CSDN博客](https://blog.csdn.net/jinmie0193/article/details/79875662)
  - [linux系统调用函数 lstat--获取文件属性 CSDN博客](https://blog.csdn.net/asjbfjsb/article/details/80295375)
  - [明晰argc -= optind, argv += optind为什么是跳过已读取的参数_CSDN博客](https://blog.csdn.net/luoliwansui/article/details/87348705)
  - [getcwd()函数的用法_CSDN博客](https://blog.csdn.net/baidu_35085676/article/details/52002579)

