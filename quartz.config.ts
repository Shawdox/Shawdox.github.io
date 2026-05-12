import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "en-US",
    baseUrl: "Shawdox.github.io",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "created",
    theme: {
      fontOrigin: "local",
      cdnCaching: true,
      typography: {
        header: "EB Garamond Local",
        body: "EB Garamond Local",
        code: "Menlo",
      },
      colors: {
        lightMode: {
          light: "#fffaf3",
          lightgray: "#f0ebe3",
          gray: "#b9aa98",
          darkgray: "#5d5045",
          dark: "#100d0a",
          secondary: "#450e02",
          tertiary: "#4f7a69",
          highlight: "rgba(226, 103, 46, 0.12)",
          textHighlight: "#fff23688",
        },
        darkMode: {
          light: "#171412",
          lightgray: "#34302c",
          gray: "#756b61",
          darkgray: "#d8cfc3",
          dark: "#f4eadf",
          secondary: "#d09a7a",
          tertiary: "#8fc7ad",
          highlight: "rgba(208, 154, 122, 0.14)",
          textHighlight: "#b3aa0288",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Disabled to avoid external font fetching during builds
      // Plugin.CustomOgImages(),
    ],
  },
}

export default config
