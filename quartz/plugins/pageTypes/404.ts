import { QuartzPageTypePlugin } from "../types"
import { match } from "./matchers"
import { NotFound } from "../../components"
import { defaultProcessedContent } from "../vfile"
import { FullSlug } from "../../util/path"

export const NotFoundPageType: QuartzPageTypePlugin = () => ({
  name: "404",
  priority: -1,
  match: match.none(),
  generate() {
    const notFound = "Not published yet"
    const slug = "404" as FullSlug
    const [, vfile] = defaultProcessedContent({
      slug,
      text: notFound,
      description: notFound,
      frontmatter: { title: notFound, tags: [] },
    })

    return [
      {
        slug,
        title: notFound,
        data: vfile.data,
      },
    ]
  },
  layout: "404",
  frame: "minimal",
  body: NotFound,
})
