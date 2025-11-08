# Page snapshot

```yaml
- dialog "Unhandled Runtime Error" [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - navigation [ref=e7]:
          - button "previous" [disabled] [ref=e8]:
            - img "previous" [ref=e9]
          - button "next" [disabled] [ref=e11]:
            - img "next" [ref=e12]
          - generic [ref=e14]: 1 of 1 error
        - button "Close" [ref=e15] [cursor=pointer]:
          - img [ref=e17]
      - heading "Unhandled Runtime Error" [level=1] [ref=e20]
      - paragraph [ref=e21]: "Error: fetch failed"
    - generic [ref=e22]:
      - heading "Source" [level=2] [ref=e23]
      - generic [ref=e24]:
        - link "app/(dashboard)/project/[id]/page.tsx (27:70) @ async ProjectPage" [ref=e26] [cursor=pointer]:
          - generic [ref=e27]: app/(dashboard)/project/[id]/page.tsx (27:70) @ async ProjectPage
          - img [ref=e28]
        - generic [ref=e32]: "25 | 26 | // Server-side parallel data fetching with preloadQuery > 27 | const [preloadedProject, preloadedCompositions, preloadedAssets] = await Promise.all([ | ^ 28 | preloadQuery(api.projects.get, { projectId }), 29 | preloadQuery(api.compositions.list, { projectId }), 30 | preloadQuery(api.media.listAssets, { projectId }),"
```