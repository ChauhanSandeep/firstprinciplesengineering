import { PageFrame, PageFrameProps } from "./types"

/**
 * The default page frame — a full-width sticky top navigation bar spanning all
 * columns, followed by a three-column layout with left sidebar, center content
 * (beforeBody + body + afterBody), and right sidebar, then a footer.
 *
 * The `header` slot is rendered inside the full-width top bar (brand, search,
 * theme/reader controls, and — injected post-build — the reading-font control
 * and the account/auth chip). This mirrors the hellointerview.com pattern:
 * global brand + controls live in the top bar, while the left rail is reserved
 * purely for content navigation (Explorer) and the right rail for the table of
 * contents + reading progress.
 */
export const DefaultFrame: PageFrame = {
  name: "default",
  render({
    componentData,
    header,
    beforeBody,
    pageBody: Content,
    afterBody,
    left,
    right,
    footer: Footer,
  }: PageFrameProps) {
    return (
      <>
        <header class="fpe-topbar">
          <div class="fpe-topbar-inner">
            {header.map((HeaderComponent) => (
              <HeaderComponent {...componentData} />
            ))}
            <div class="fpe-topbar-actions" data-fpe-topbar-actions></div>
          </div>
        </header>
        <div class="left sidebar">
          {left.map((BodyComponent) => (
            <BodyComponent {...componentData} />
          ))}
        </div>
        <main class="center">
          <div class="page-header">
            <div class="popover-hint">
              {beforeBody.map((BodyComponent) => (
                <BodyComponent {...componentData} />
              ))}
            </div>
          </div>
          <Content {...componentData} />
          <hr />
          <div class="page-footer">
            {afterBody.map((BodyComponent) => (
              <BodyComponent {...componentData} />
            ))}
          </div>
        </main>
        <div class="right sidebar">
          {right.map((BodyComponent) => (
            <BodyComponent {...componentData} />
          ))}
        </div>
        <Footer {...componentData} />
      </>
    )
  },
}
