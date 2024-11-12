import * as React from "react";
import styled from "styled-components";
import useKlankStore from "web/state/store";
import YoutubeIcon from "./icons/YoutubeIcon";
import { open } from '@tauri-apps/plugin-shell';
import Input from "./Input";

const TabDetailsContainer = styled.div`
    padding: 16px;
    color: ${props => props.theme.textColor};
    h1 {
        font-size: 1.2em;
        line-height: 1.4em;
    }
    h2 {
        font-size: 1.1em;
        line-height: 1.3em;
    }
    p {
        
    }
`

type TabDetailsProps = {

}


const Textarea = styled.textarea<{$mode: string}>`
    width: 100%;
    color: ${props => props.theme.textColor};
`


const TabDetails: React.FC<TabDetailsProps> = ({ ...props }) => {
  const mode = useKlankStore().mode
  const currentTabPath = useKlankStore().tab.path
  const splitTabPath = currentTabPath.split(/[\/\\]/)
  const tabFileName = splitTabPath[splitTabPath.length - 1]
  const tabName = tabFileName?.substring(0, tabFileName.length - 8)
  const tabDetails = useKlankStore().tab.details
  const tabLink = useKlankStore().tab.link
  const setTabDetails = useKlankStore().setTabDetails
  const setTabLink = useKlankStore().setTabLink

  return <TabDetailsContainer {...props}>
    <h1>{tabName}</h1>
    {mode === "Edit" && <>
      <Textarea $mode={mode} id="tab-details-edit-textarea" defaultValue={tabDetails}
                onChange={event => setTabDetails(event.target.value)}></Textarea>
      <Input
        value={tabLink}
        iconLeft={<YoutubeIcon/>}
        placeholder='Youtube link'
        onInput={(value) => setTabLink(value.toString())}
      />
    </>}

    {mode === "Read" && tabLink !== undefined && tabLink.length !== 0 &&
      <button onClick={() => open(tabLink ?? '')}>youtube link <YoutubeIcon/></button>}

    {mode === "Read" && <p>
      {tabDetails}
    </p>}
  </TabDetailsContainer>
}

export default TabDetails
