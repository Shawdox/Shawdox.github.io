---
date: 2023/08/15 16:11:35
title: (技术积累)FuzzBuilder复现
author: Shaw
categories: Paper
tags: ["Fuzzing"]
---

# FuzzBuilder复现

Use of FuzzBuilder and some technical analysis.



## 1. Tutorial

​	由于国内科学上网等原因（可能），[hksecurity/FuzzBuilder (github.com)](https://github.com/hksecurity/FuzzBuilder)给的dockerfile使用一直有问题，故这里直接使用ubuntu18.04镜像新建docker：

​	Due to domestic Internet access in China and other reasons (probably), the dockerfile given by [hksecurity/FuzzBuilder (github.com)](https://github.com/hksecurity/FuzzBuilder) has been problematic to use, so here is the direct use of the ubuntu18.04 image to create a new docker:

```bash
docker pull homebrew/ubuntu18.04
```

​	然后根据仓库给出的指令安装相关包：

​	Then follow the instructions given by the repository to install the relevant packages:

```bash
apt-get install clang-6.0 clang-6.0-dev llvm-6.0 llvm-6.0-dev
ln -s /usr/bin/clang-6.0 /usr/bin/clang
apt-get install git wget build-essential cmake gcc-multilib g++-multilib gnupg zip autoconf automake libtool docbook2x zlib1g-dev rapidjson-dev
```

​	注意，这里只安装了clang没有安装clang++，故再补一个：

​	Note that only clang is installed here but not clang++, so another one is added:

```bash
apt-get install clang++-6.0 clang++-6.0-dev
ln -s /usr/bin/clang++-6.0 /usr/bin/clang++
```

​	安装AFL（后期可替换为AFL++）：

​	Install AFL (which can be replaced with AFL++ at a later stage):

```bash
git clone https://github.com/google/AFL.git
cd AFL
make
export AFL_PATH=$PWD
export PATH=$PATH:$PWD
```

​	编译FuzzBuilder：

​	Compile FuzzBuilder:

```bash
git clone https://github.com/hksecurity/FuzzBuilder.git
cd FuzzBuilder
export FuzzBuilder=$PWD
mkdir -p $FuzzBuilder/build && cd $FuzzBuilder/build
cmake build ../src
make
```

​	安装emscripten:

​	Install emscripten:

```bash
# Get the emsdk repo
git clone https://github.com/emscripten-core/emsdk.git
# Enter that directory
cd emsdk
# Fetch the latest version of the emsdk (not needed the first time you clone)
git pull
# Download and install the latest SDK tools.
./emsdk install latest
# Make the "latest" SDK "active" for the current user. (writes .emscripten file)
./emsdk activate latest
# Activate PATH and other environment variables in the current terminal
source ./emsdk_env.sh
```

​	至此所需软件安装编译完成。

​	This completes the installation and compilation of the required software.

## 2. Example: expat

​	这里利用XML解析器库expat来举例说明FuzzBuilder的使用方法。

​	The XML parser library expat is used here as an example to illustrate the use of FuzzBuilder.

### 2.1 Seed generation

- **下载源码，并切换到指定版本（Download the source code and switch to the specified version）**

```bash
mkdir -p $FuzzBuilder/exp/expat/source && cd $FuzzBuilder/exp/expat/source
git clone [https://github.com/libexpat/libexpat](https://github.com/libexpat/libexpat) && cd libexpat
git checkout 39e487da353b20bb3a724311d179ba0fddffc65b
```

- **引入辅助脚本（Introducing auxiliary scripts）**

```bash
cp $FuzzBuilder/exp/expat/fuzzer_main.cc ./expat
cp $FuzzBuilder/exp/expat/build.sh ./expat
```

​	`build.sh`是expat项目的编译脚本，这里将其中的CC和CXX换成了对应的afl-clang和afl-clang++。

​	`build.sh`is the compilation script for the expat project, where CC and CXX have been replaced with the corresponding afl-clang and afl-clang++.

- **编译项目(Compile)：**

```bash
cd $FuzzBuilder/exp/expat/source/libexpat/expat
# edit CC, CXX variable with correct path
vi ./build.sh
./build.sh seed
```

​	如果在运行build.sh脚本时指定了cov或者seed，则会直接执行make，否则会使用AFL_USE_ASAN=1。

​	编译好的项目会在build文件夹下生成一个`fuzzbuilder`可执行文件。

​	If `cov `or `seed `is specified when running the build.sh script, make will be executed directly, otherwise AFL_USE_ASAN=1 will be used.

​	The compiled project generates a fuzzbuilder executable in the build folder.



- **生成种子(Seed generation)：**

```bash
afl-clang -emit-llvm -DHAVE_CONFIG_H -I. -I.. -DHAVE_EXPAT_CONFIG_H -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -c lib/xmlparse.c -fPIC -DPIC

$FuzzBuilder/build/fuzzbuilder seed $FuzzBuilder/exp/expat/seed.conf
```

​	上述命令将目标库lib/xmlparse.c编译为bitcode：xmlparse.bc，`-m32`表明32位。然后使用fuzzbuilder命令从seed.conf中读取配置文件并生成种子。

​	The above command compiles the target library lib/xmlparse.c to bitcode: xmlparse.bc, with `-m32 ` indicating 32-bit. Then use the fuzzbuilder command to read the configuration file from seed.conf and generate the seed.

​	seed.conf是FuzzBuilder自带的文件，其指明了：

​	seed.conf is the file that comes with FuzzBuilder that specifies:

```conf
{
    "targets" : [ [ "XML_Parse", 2, 3 ]],
    "files" : [ "xmlparse.bc" ]
}
```

​	`target`表明了需要分析的函数`XML_Parse()`和fuzzer需要给该函数传递的参数，2,3代表了第二个参数用于传递input，第三个用于表示input的大小。

​	`files`表明了需要分析的文件，其以bitcode的形式输入。



​	`target `indicates the function `XML_Parse`() to be analyzed and the parameters that fuzzer needs to pass to this function, 2,3 represents the second parameter used to pass the input, and the third is used to indicate the size of the input.
​	`files `indicates the file to be analyzed, which is input in the form of a bitcode.



​	以上命令运行结果如下：

​	The result of running the above command is as follows:

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230818190723.png" style="zoom:67%;" />

​	可以看到，插桩后的文件以`xmlparse.bc.mod.bc`存在。接下来编译这个插桩后的bc文件：

​	As you can see, the instrumented file exists as `xmlparse.bc.mod.bc`. Next, compile this instrumented bc file:

```bash
afl-clang -DHAVE_CONFIG_H -I. -I.. -DHAVE_EXPAT_CONFIG_H -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -c xmlparse.bc.mod.bc -fPIC -DPIC -o xmlparse.o
ar r lib/.libs/libexpat.a xmlparse.o
rm -f tests/runtests
make check
```

​	以上命令将插桩后的bc文件编译为了`xmlparse.o`，并使用ar命令将 "xmlparse.o" 文件添加到名为 "libexpat.a" 的归档文件中，以便构建完整的静态库。这样在链接时，可以使用这个静态库来提供 "xmlparse.o" 中定义的函数和符号。

​	The above command compiles the staked bc file to `xmlparse.o  `  and uses the ar command to add the "xmlparse.o" file to an archive named "libexpat.a" in order to build the complete static library. This static library can then be used to provide the functions and symbols defined in "xmlparse.o" at link time.

​	接下来运行seed_maker.py脚本从已经生成的种子中提取（其中这里的`fuzzbuilder.collect`就是上一步中make check运行插桩后的单元测试时生成的种子文件）：

​	Next run the seed_maker.py script to extract from the seeds that have been generated (where `fuzzbuilder.collect` here is the seed file that was generated when make check ran the unit tests after instrumenting in the previous step):

```bash
mv /tmp/fuzzbuilder.collect .
python $FuzzBuilder/script/seed_maker.py fuzzbuilder.collect seed_fb
mkdir -p $FuzzBuilder/exp/expat/seed/fuzzbuilder
mv $FuzzBuilder/exp/expat/source/libexpat/expat/seed_fb $FuzzBuilder/exp/expat/seed/fuzzbuilder/org
```

​	可以看到生成的种子库：

​	You can see the generated seeds:

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230819095110.png" style="zoom:80%;" />

### 2.2 executable file generation

​	这里根据作者给出的两个配置文件`XML_Parse.conf`和`bug.conf`对runtest.c做插桩，生成了两个可执行文件。

​	Here two executables are generated by instrumenting runtest.c according to the two configuration files `XML_Parse.conf` and `bug.conf` given by the author.

```bash
#进入其自带的文件夹
cd $FuzzBuilder/exp/expat/source/libexpat/expat/tests
#将runtest.c编译为bitcode
afl-clang -emit-llvm -DHAVE_CONFIG_H -I. -I.. -I./../lib -DHAVE_EXPAT_CONFIG_H -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -c runtests.c
#根据配置文件生成runtests.bc.mod.bc
$FuzzBuilder/build/fuzzbuilder exec $FuzzBuilder/exp/expat/XML_Parse.conf
#编译生成可执行文件
$AFL_PATH/afl-clang -DHAVE_CONFIG_H -I. -I.. -I./../lib -DHAVE_EXPAT_CONFIG_H -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -o runtests.o -c runtests.bc.mod.bc
$AFL_PATH/afl-clang -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -fno-strict-aliasing -o XML_Parse_fuzzer runtests.o libruntests.a ../lib/.libs/libexpat.a
mkdir -p $FuzzBuilder/exp/expat/bin/fuzz/fuzzbuilder
mv XML_Parse_fuzzer $FuzzBuilder/exp/expat/bin/fuzz/fuzzbuilder

#根据配置文件生成runtests.bc.mod.bc，bug.conf相较于XML_Parse.conf跳过了一些函数
$FuzzBuilder/build/fuzzbuilder exec $FuzzBuilder/exp/expat/bug.conf
afl-clang -DHAVE_CONFIG_H -I. -I.. -I./../lib -DHAVE_EXPAT_CONFIG_H -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -o runtests.o -c runtests.bc.mod.bc
afl-clang -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -fno-strict-aliasing -o XML_Parse_fuzzer runtests.o libruntests.a ../lib/.libs/libexpat.a
mv XML_Parse_fuzzer $FuzzBuilder/exp/expat/bin/fuzz/fuzzbuilder/bug_fuzzer
```

​	如果要成带有代码覆盖率的可执行文件：

​	If it is to be an executable with code coverage:

```bash
cd $FuzzBuilder/exp/expat/source/libexpat/expat/tests
afl-clang -emit-llvm -DHAVE_CONFIG_H -I. -I.. -I./../lib -DHAVE_EXPAT_CONFIG_H -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -c runtests.c
$FuzzBuilder/build/fuzzbuilder exec $FuzzBuilder/exp/expat/XML_Parse.conf
afl-clang -DHAVE_CONFIG_H -I. -I.. -I./../lib -DHAVE_EXPAT_CONFIG_H -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -o runtests.o -c runtests.bc.mod.bc
afl-clang -fprofile-arcs -ftest-coverage -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -m32 -g -fno-strict-aliasing -o XML_Parse_fuzzer runtests.o  libruntests.a ../lib/.libs/libexpat.a
mkdir -p $FuzzBuilder/exp/expat/bin/cov/fuzzbuilder
mv XML_Parse_fuzzer $FuzzBuilder/exp/expat/bin/cov/fuzzbuilder
```

### 2.3 种子优化

​	使用AFL自带的afl-cmin对种子库做优化：

​	Use afl-cmin that comes with AFL to optimize the seed library:

```bash
cd $FuzzBuilder/exp/expat
$AFL_PATH/afl-cmin -m 1024 -i seed/fuzzbuilder/org/XML_Parse -o seed/eval/XML_Parse_fuzzer/fuzzbuilder bin/fuzz/fuzzbuilder/XML_Parse_fuzzer @@
```

​	下面就可以直接用生成的可执行文件和种子进行fuzzing了。

​	The following can be used directly for fuzzing with the generated executable and seed.



## Problem:

When I try to compile expat's test file `runtests.c` to wasm binary:

1. **Build the expat with emscripten.**

   Since the target file needs to use many of expat's library files when linking, I think I should recompile the expat project first with emcc.So I modified the build.sh for expat:

   ![Modified build.sh for expat project](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230821142419.png)

   As you can see, I used emcc to build the project.

   ```bash
   cd $FuzzBuilder/exp/expat/source/libexpat/expat
   ./build.sh wasm
   ```

2. **Generate seed files**

   This step is the same process as described above, the only difference is that it is compiled with emcc.

   ```bash
   emcc -emit-llvm -DHAVE_CONFIG_H -I. -I.. -DHAVE_EXPAT_CONFIG_H -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -c lib/xmlparse.c -fPIC -DPIC
   
   $FuzzBuilder/build/fuzzbuilder seed $FuzzBuilder/exp/expat/seed.conf
   
   emcc -DHAVE_CONFIG_H -I. -I.. -DHAVE_EXPAT_CONFIG_H -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -c xmlparse.bc.mod.bc -fPIC -DPIC -o xmlparse.o
   ar r lib/.libs/libexpat.a xmlparse.o
   rm -f tests/runtests
   make check
   ```

3. **Generate executable file**

   Because fuzzbuilder can only analyze the bitcode of LLVM 6.0 version, so this step can't use emcc to compile runtests.c to bc file directly, so I choose to use clang6.0 to compile:

   ```bash
   clang -emit-llvm -DHAVE_CONFIG_H -I. -I.. -I./../lib -DHAVE_EXPAT_CONFIG_H -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -c runtests.c
   ```

   Then use fuzzerbuild to instrument and generate:

   ```bash
   $FuzzBuilder/build/fuzzbuilder exec $FuzzBuilder/exp/expat/XML_Parse.conf
   ```

   The instrumented code is called `runtests.bc.mod.bc`, and this code is compiled into an executable file which is the fuzz target we need.

   Here it is compiled using emcc:

   ```bash
   emcc -DHAVE_CONFIG_H -I. -I.. -I./../lib -DHAVE_EXPAT_CONFIG_H -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -o runtests.o -c runtests.bc.mod.bc
   emcc -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -fno-strict-aliasing -o XML_Parse_fuzzer runtests.o libruntests.a ../lib/.libs/libexpat.a
   ```

   But something went wrong:

   ![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230821143411.png)

   >**Error Messages:**
   >
   >[linuxbrew@708fe4a082ee:tests]$ emcc -DHAVE_CONFIG_H -I. -I.. -I./../lib -DHAVE_EXPAT_CONFIG_H -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -o runtests.o -c runtests.bc.mod.bc
   >clang++: warning: argument unused during compilation: '-I .' [-Wunused-command-line-argument]
   >clang++: warning: argument unused during compilation: '-I ..' [-Wunused-command-line-argument]
   >clang++: warning: argument unused during compilation: '-I ./../lib' [-Wunused-command-line-argument]
   >warning: overriding the module target triple with wasm32-unknown-emscripten [-Woverride-module]
   >'pentium4' is not a recognized processor for this target (ignoring processor)
   >'+fxsr' is not a recognized feature for this target (ignoring feature)
   >'+mmx' is not a recognized feature for this target (ignoring feature)
   >'+sse' is not a recognized feature for this target (ignoring feature)
   >'+sse2' is not a recognized feature for this target (ignoring feature)
   >'+x87' is not a recognized feature for this target (ignoring feature)
   >'pentium4' is not a recognized processor for this target (ignoring processor)
   >'pentium4' is not a recognized processor for this target (ignoring processor)
   >'+fxsr' is not a recognized feature for this target (ignoring feature)
   >'+mmx' is not a recognized feature for this target (ignoring feature)
   >'+sse' is not a recognized feature for this target (ignoring feature)
   >'+sse2' is not a recognized feature for this target (ignoring feature)
   >'+x87' is not a recognized feature for this target (ignoring feature)
   >'pentium4' is not a recognized processor for this target (ignoring processor)
   >1 warning generated.
   >[linuxbrew@708fe4a082ee:tests]$ emcc -m32 -g -Wall -Wmissing-prototypes -Wstrict-prototypes -fexceptions -fno-strict-aliasing -fno-strict-aliasing -o XML_Parse_fuzzer runtests.o libruntests.a ../lib/.libs/libexpat.a
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_buffer
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_size
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_size
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_size
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_buffer
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_buffer
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_size
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_size
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_buffer
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_size
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_buffer
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_size
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_buffer
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_size
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_buffer
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_size
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_buffer
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_size
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_buffer
   >wasm-ld: error: runtests.o: undefined symbol: fuzzbuilder_size
   >wasm-ld: error: too many errors emitted, stopping now (use -error-limit=0 to see all errors)
   >emcc: error: '/home/linuxbrew/emsdk/upstream/bin/wasm-ld -o XML_Parse_fuzzer.wasm runtests.o libruntests.a ../lib/.libs/libexpat.a -L/home/linuxbrew/emsdk/upstream/emscripten/cache/sysroot/lib/wasm32-emscripten -lGL -lal -lhtml5 -lstubs-debug -lnoexit -lc-debug -ldlmalloc -lcompiler_rt -lc++ -lc++abi-debug -lsockets -mllvm -combiner-global-alias-analysis=false -mllvm -enable-emscripten-cxx-exceptions -mllvm -enable-emscripten-sjlj -mllvm -disable-lsr /tmp/tmppqspurs4libemscripten_js_symbols.so --export-if-defined=main --export-if-defined=__get_exception_message --export-if-defined=free --export-if-defined=__start_em_asm --export-if-defined=__stop_em_asm --export-if-defined=__start_em_lib_deps --export-if-defined=__stop_em_lib_deps --export-if-defined=__start_em_js --export-if-defined=__stop_em_js --export-if-defined=__main_argc_argv --export-if-defined=fflush --export=emscripten_stack_get_end --export=emscripten_stack_get_free --export=emscripten_stack_get_base --export=emscripten_stack_get_current --export=emscripten_stack_init --export=stackSave --export=stackRestore --export=stackAlloc --export=__errno_location --export=__get_temp_ret --export=__set_temp_ret --export=__cxa_is_pointer_type --export=__cxa_can_catch --export=__cxa_increment_exception_refcount --export=__cxa_decrement_exception_refcount --export=setThrew --export=__cxa_free_exception --export=__wasm_call_ctors --export=__get_exception_message --export=free --export-table -z stack-size=65536 --initial-memory=16777216 --no-entry --max-memory=16777216 --stack-first' failed (returned 1)



​		

```bash
/home/linuxbrew/myAFLpp/afl-clang++  -m32 -Werror -Wformat=2 -Wsign-compare -Wwrite-strings -Wvla -Wshadow -Wtype-limits -ggdb -Wall -fvisibility=hidden -fno-common -Wnewline-eof -fcolor-diagnostics -Wimplicit-fallthrough -Wmissing-declarations -Wmissing-prototypes  -m32 CMakeFiles/crypto_test_data.dir/crypto_test_data.cc.o CMakeFiles/crypto_test.dir/crypto/abi_self_test.cc.o CMakeFiles/crypto_test.dir/crypto/asn1/asn1_test.cc.o CMakeFiles/crypto_test.dir/crypto/base64/base64_test.cc.o CMakeFiles/crypto_test.dir/crypto/bio/bio_test.cc.o CMakeFiles/crypto_test.dir/crypto/blake2/blake2_test.cc.o CMakeFiles/crypto_test.dir/crypto/buf/buf_test.cc.o CMakeFiles/crypto_test.dir/crypto/bytestring/bytestring_test.cc.o CMakeFiles/crypto_test.dir/crypto/chacha/chacha_test.cc.o CMakeFiles/crypto_test.dir/crypto/cipher_extra/aead_test.cc.o CMakeFiles/crypto_test.dir/crypto/cipher_extra/cipher_test.cc.o CMakeFiles/crypto_test.dir/crypto/compiler_test.cc.o CMakeFiles/crypto_test.dir/crypto/conf/conf_test.cc.o CMakeFiles/crypto_test.dir/crypto/constant_time_test.cc.o CMakeFiles/crypto_test.dir/crypto/cpu_arm_linux_test.cc.o CMakeFiles/crypto_test.dir/crypto/crypto_test.cc.o CMakeFiles/crypto_test.dir/crypto/curve25519/ed25519_test.cc.o CMakeFiles/crypto_test.dir/crypto/curve25519/spake25519_test.cc.o CMakeFiles/crypto_test.dir/crypto/curve25519/x25519_test.cc.o CMakeFiles/crypto_test.dir/crypto/ecdh_extra/ecdh_test.cc.o CMakeFiles/crypto_test.dir/crypto/dh_extra/dh_test.cc.o CMakeFiles/crypto_test.dir/crypto/digest_extra/digest_test.cc.o CMakeFiles/crypto_test.dir/crypto/dsa/dsa_test.cc.o CMakeFiles/crypto_test.dir/crypto/err/err_test.cc.o CMakeFiles/crypto_test.dir/crypto/evp/evp_extra_test.cc.o CMakeFiles/crypto_test.dir/crypto/evp/evp_test.cc.o CMakeFiles/crypto_test.dir/crypto/evp/pbkdf_test.cc.o CMakeFiles/crypto_test.dir/crypto/evp/scrypt_test.cc.o CMakeFiles/crypto_test.dir/crypto/fipsmodule/aes/aes_test.cc.o CMakeFiles/crypto_test.dir/crypto/fipsmodule/bn/bn_test.cc.o CMakeFiles/crypto_test.dir/crypto/fipsmodule/cmac/cmac_test.cc.o CMakeFiles/crypto_test.dir/crypto/fipsmodule/ec/ec_test.cc.o CMakeFiles/crypto_test.dir/crypto/fipsmodule/ec/p256-nistz_test.cc.o CMakeFiles/crypto_test.dir/crypto/fipsmodule/ecdsa/ecdsa_test.cc.o CMakeFiles/crypto_test.dir/crypto/fipsmodule/hkdf/hkdf_test.cc.o CMakeFiles/crypto_test.dir/crypto/fipsmodule/md5/md5_test.cc.o CMakeFiles/crypto_test.dir/crypto/fipsmodule/modes/gcm_test.cc.o CMakeFiles/crypto_test.dir/crypto/fipsmodule/rand/ctrdrbg_test.cc.o CMakeFiles/crypto_test.dir/crypto/fipsmodule/rand/fork_detect_test.cc.o CMakeFiles/crypto_test.dir/crypto/fipsmodule/service_indicator/service_indicator_test.cc.o CMakeFiles/crypto_test.dir/crypto/fipsmodule/sha/sha_test.cc.o CMakeFiles/crypto_test.dir/crypto/hpke/hpke_test.cc.o CMakeFiles/crypto_test.dir/crypto/hmac_extra/hmac_test.cc.o CMakeFiles/crypto_test.dir/crypto/hrss/hrss_test.cc.o CMakeFiles/crypto_test.dir/crypto/impl_dispatch_test.cc.o CMakeFiles/crypto_test.dir/crypto/kyber/kyber_test.cc.o CMakeFiles/crypto_test.dir/crypto/lhash/lhash_test.cc.o CMakeFiles/crypto_test.dir/crypto/obj/obj_test.cc.o CMakeFiles/crypto_test.dir/crypto/pem/pem_test.cc.o CMakeFiles/crypto_test.dir/crypto/pkcs7/pkcs7_test.cc.o CMakeFiles/crypto_test.dir/crypto/pkcs8/pkcs8_test.cc.o CMakeFiles/crypto_test.dir/crypto/pkcs8/pkcs12_test.cc.o CMakeFiles/crypto_test.dir/crypto/poly1305/poly1305_test.cc.o CMakeFiles/crypto_test.dir/crypto/pool/pool_test.cc.o CMakeFiles/crypto_test.dir/crypto/rand_extra/rand_test.cc.o CMakeFiles/crypto_test.dir/crypto/rand_extra/getentropy_test.cc.o CMakeFiles/crypto_test.dir/crypto/refcount_test.cc.o CMakeFiles/crypto_test.dir/crypto/rsa_extra/rsa_test.cc.o CMakeFiles/crypto_test.dir/crypto/self_test.cc.o CMakeFiles/crypto_test.dir/crypto/stack/stack_test.cc.o CMakeFiles/crypto_test.dir/crypto/siphash/siphash_test.cc.o CMakeFiles/crypto_test.dir/crypto/thread_test.cc.o CMakeFiles/crypto_test.dir/crypto/test/file_test_gtest.cc.o CMakeFiles/crypto_test.dir/crypto/test/gtest_main.cc.o CMakeFiles/crypto_test.dir/crypto/trust_token/trust_token_test.cc.o CMakeFiles/crypto_test.dir/crypto/x509/x509_test.cc.o CMakeFiles/crypto_test.dir/crypto/x509/x509_time_test.cc.o CMakeFiles/crypto_test.dir/crypto/x509v3/tab_test.cc.o | libtest_support_lib.a libboringssl_gtest.a crypto/libcrypto.a || crypto/libcrypto.a crypto_test_data libboringssl_gtest.a libtest_support_lib.a  -o crypto_test  libtest_support_lib.a libboringssl_gtest.a crypto/libcrypto.a -lpthread
cd /home/linuxbrew/FuzzBuilder/exp/boringssl/source/boringssl
/usr/bin/cmake -E make_directory /home/linuxbrew/FuzzBuilder/exp/boringssl/source/boringssl/crypto
/usr/bin/cmake -E copy /home/linuxbrew/FuzzBuilder/exp/boringssl/source/boringssl/crypto_test /home/linuxbrew/FuzzBuilder/exp/boringssl/source/boringssl/crypto
```

