---
date: 2025/5/27
title: Different categories of kernel
author: Shaw
categories: Paper
tags: ["Syzkaller","Fuzzing","Kernel"]

---

# Different categories of kernel

Stable, LTS, SLTS, rt, ...



### Kernel categories

- Prepatch (rc)

  Prepatch or "RC" kernels are mainline kernel pre-releases that are mostly aimed at other kernel developers and Linux enthusiasts. They must be compiled from source and usually contain new features that must be tested before they can be put into a stable release. Prepatch kernels are maintained and released by Linus Torvalds.

- Mainline

  Mainline tree is maintained by Linus Torvalds. It's the tree where all new features are introduced and where all the exciting new development happens. New mainline kernels are released every 9-10 weeks.

- Stable

  After each mainline kernel is released, it is considered "stable." Any bug fixes for a stable kernel are backported from the mainline tree and applied by a designated stable kernel maintainer. There are usually only a few bugfix kernel releases until next mainline kernel becomes available -- unless it is designated a "longterm maintenance kernel." Stable kernel updates are released on as-needed basis, usually once a week.

- Longterm

  There are usually several "longterm maintenance" kernel releases provided for the purposes of backporting bugfixes for older kernel trees. Only important bugfixes are applied to such kernels and they don't usually see very frequent releases, especially for older trees.

| Version | Maintainer                       | Released   | Projected EOL |
| ------- | -------------------------------- | ---------- | ------------- |
| 6.12    | Greg Kroah-Hartman & Sasha Levin | 2024-11-17 | Dec, 2026     |
| 6.6     | Greg Kroah-Hartman & Sasha Levin | 2023-10-29 | Dec, 2026     |
| 6.1     | Greg Kroah-Hartman & Sasha Levin | 2022-12-11 | Dec, 2027     |
| 5.15    | Greg Kroah-Hartman & Sasha Levin | 2021-10-31 | Dec, 2026     |
| 5.10    | Greg Kroah-Hartman & Sasha Levin | 2020-12-13 | Dec, 2026     |
| 5.4     | Greg Kroah-Hartman & Sasha Levin | 2019-11-24 | Dec, 2025     |

Currently syzbot only support 5.15 and 6.1 LTS version

### Upsteam & Downstream Kernel



### References

- https://www.kernel.org/category/releases.html
- https://www.linuxquestions.org/questions/linux-kernel-70/what-is-an-upstream-kernel-894097/