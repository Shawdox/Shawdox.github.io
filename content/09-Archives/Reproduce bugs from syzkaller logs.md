---
date: 2025/5/14
title: (Syzkaller)Reproduce bugs from syzkaller logs
author: Shaw
categories: Paper
tags: ["Syzkaller","Fuzzing","Kernel"]
---

# Reproduce bugs from syzkaller logs

Currently I just got some unreprodueced and unminimized crash logs from syzkaller, there are some scripts to get the key program ledding crash and reproduce it.



#### 1. Get the upstream kernel

Get the target kernel:

```bash
wget https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-6.14.6.tar.xz 
tar -Jvxf linux-6.14.6.tar.xz
```

Build the kernel:

```bash
#!/bin/bash
# Compiling kernel of any version
# Example: ./compile.sh 6.1.11

images=/home/wuxiao/Syzkaller_Test/linux_images
kernel="linux-$1"
#cc=gcc
cc=gcc-11

cd "${images}/${kernel}"
make CC=${cc} defconfig
make CC=${cc} kvm_guest.config

printf '\n# Coverage collection.\nCONFIG_KCOV=y\n\n# Debug info for symbolization.\nCONFIG_DEBUG_INFO_DWARF4=y\n\n# Memory bug detector\nCONFIG_KASAN=y\nCONFIG_KASAN_INLINE=y\n\n# Required for Debian Stretch and later\nCONFIG_CONFIGFS_FS=y\nCONFIG_SECURITYFS=y\n\nCONFIG_CMDLINE_BOOL=y\nCONFIG_CMDLINE="net.ifnames=0"\n' >> .config
make CC=${cc} olddefconfig

make HOSTCC=${cc} CC=${cc} -j`nproc`

```

```bash
./compile.sh 6.14.6
```

You can also use the current upstream conifg from syzbot:
https://github.com/google/syzkaller/blob/0919b50b3e3291cd417a53ea6fb638ac2d8a4a93/dashboard/config/linux/upstream-apparmor-kasan.config

```bash
#!/bin/bash
# Compiling kernel of any version
# Example: ./compile.sh 6.1.11

images=/home/wuxiao/Syzkaller_Test/linux_images
kernel="linux-$1"
cc=gcc-11
config=/home/wuxiao/Syzkaller_Test/linux_images/upstream-apparmor-kasan.config

cd "${images}/${kernel}"
make CC=${cc} defconfig
make CC=${cc} kvm_guest.config
cat $config > .config
make CC=${cc} olddefconfig

make HOSTCC=${cc} CC=${cc} -j`nproc`

```

#### 2. Reproduce

Start VM (qemu here):

```bash
#/bin/bash
# start_vm.sh
KERNEL=/home/wuxiao/Syzkaller_Test/linux_images/linux-6.15-rc7
IMAGE=/home/wuxiao/Syzkaller_Test/image
qemu-system-x86_64 \
	-m 1G \
	-smp 2 \
	-kernel ${KERNEL}/arch/x86/boot/bzImage \
	-append "console=ttyS0 root=/dev/sda earlyprintk=serial net.ifnames=0" \
	-drive file=${IMAGE}/bullseye.img,format=raw \
	-net user,host=10.0.2.10,hostfwd=tcp:127.0.0.1:10021-:22 \
	-net nic,model=e1000 \
	-enable-kvm \
	-nographic \
    -snapshot \
	-pidfile vm.pid \
	2>&1 | tee vm.log
```

Copy `syz-execprog`, `syz-exectutor` into VM:

```bash
export REPRO_PATH="/home/wuxiao/Syzkaller_Test/repro_syzkaller"
scp -P 10021 -o UserKnownHostsFile=/dev/null  -o StrictHostKeyChecking=no -o IdentitiesOnly=yes $REPRO_PATH/bin/linux_amd64/* root@127.0.0.1:/root/
```

Execute the progs through crash log:

```bash
ssh -p 10021 -o UserKnownHostsFile=/dev/null  -o StrictHostKeyChecking=no -o IdentitiesOnly=yes root@127.0.0.1 './syz-execprog -enable=all -repeat=0 -procs=8 -cover=0 log0'
```

For the existing syz programs:

```bash
# Copy the syz prog
REPRO=/home/wuxiao/Syzkaller_Test/test/6.1.1/crashes/5ac71a8ea9b211eb72bfbbf1f4699c4298c20dd6/repro.prog && scp -P 10021 -o UserKnownHostsFile=/dev/null  -o StrictHostKeyChecking=no -o IdentitiesOnly=yes ${REPRO} root@127.0.0.1:/root/repro.syz
```

```bash
# Execute
ssh -p 10021 -o UserKnownHostsFile=/dev/null  -o StrictHostKeyChecking=no -o IdentitiesOnly=yes root@127.0.0.1 './syz-execprog -enable=all -repeat=0 -procs=8 -cover=0 ./repro.syz'
```

#### 3. Report

A bug found on old versions must be reproduced successfully on a fresh kernel.

- Report: https://github.com/google/syzkaller/blob/0919b50b3e3291cd417a53ea6fb638ac2d8a4a93/docs/linux/reporting_kernel_bugs.md



## References

- https://www.kernel.org/
- https://github.com/google/syzkaller/blob/master/docs/reproducing_crashes.md#from-execution-logs
- https://github.com/google/syzkaller/blob/0919b50b3e3291cd417a53ea6fb638ac2d8a4a93/dashboard/config/linux/upstream-apparmor-kasan.config