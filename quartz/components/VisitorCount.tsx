// @ts-ignore
import script from "./scripts/visitorCount.inline"
import style from "./styles/visitorCount.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

interface Options {
  label?: string
}

const defaultOptions: Options = {
  label: "访客",
}

export default ((userOpts?: Options) => {
  const opts = { ...defaultOptions, ...userOpts }

  const VisitorCount: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    return (
      <p class={classNames(displayClass, "visitor-count")}>
        <span>{opts.label}</span>
        <span id="busuanzi_value_site_uv" class="visitor-count-number">
          --
        </span>
        <span>人</span>
      </p>
    )
  }

  VisitorCount.css = style
  VisitorCount.afterDOMLoaded = script
  return VisitorCount
}) satisfies QuartzComponentConstructor
