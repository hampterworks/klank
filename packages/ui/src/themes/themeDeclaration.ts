   // theme.d.ts
   import 'styled-components'

   declare module 'styled-components' {
     export interface DefaultTheme {
       background: string
       secondaryBackground: string
       textColor: string
       borderColor: string
       highlight: string
       selected: string
       success: string
       fail: string
     }
   }