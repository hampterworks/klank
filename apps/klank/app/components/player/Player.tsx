import React, { useEffect, useState } from 'react'
import styles from './player.module.css'
import { Sheet, SheetToolbar } from '@klank/ui'
import { useKlankStore } from '@klank/store'

type SheetProps = {} & React.ComponentPropsWithRef<'section'>

const Player: React.FC<SheetProps> = ({ ...props }) => {
  const setTabFontSize = useKlankStore().setTabFontSize
  const fontSize = useKlankStore().tab.fontSize
  const transpose = useKlankStore().tab.transpose
  const setTabTranspose = useKlankStore().setTabTranspose
  const setTabScrollSpeed = useKlankStore().setTabScrollSpeed
  const tabScrollSpeed = useKlankStore().tab.scrollSpeed
  const isScrolling = useKlankStore().tab.isScrolling
  const setTabIsScrolling = useKlankStore().setTabIsScrolling
  const tabPath = useKlankStore().tab.path
  const readTabFile = useKlankStore().fileService?.readTabFile
  const [tabData, setTabData] = useState<string | undefined>()

  useEffect(() => {
    if (!readTabFile) return
    readTabFile(tabPath).then((data) => setTabData(data))
  }, [tabPath, readTabFile])

  return (
    <section className={styles.container} {...props}>
      <SheetToolbar
        fontSize={fontSize}
        songName={tabPath
          ?.split(/[\/\\]/)
          ?.slice(-1)[0]
          ?.slice(0, -8)}
        transpose={transpose}
        tabScrollSpeed={tabScrollSpeed}
        isScrolling={isScrolling}
        setTabFontSize={setTabFontSize}
        setTabTranspose={setTabTranspose}
        setTabScrollSpeed={setTabScrollSpeed}
        setTabIsScrolling={setTabIsScrolling}
      />
      <Sheet
        tabScrollSpeed={tabScrollSpeed}
        isScrolling={isScrolling}
        tabData={tabData ?? ''}
        transpose={transpose}
        style={{ fontSize: `${fontSize}px` }}
      />
    </section>
  )
}

export default Player
