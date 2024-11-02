import * as React from "react";
import styled from "styled-components";
import useKlankStore from "web/state/store";
import path from "node:path";

const TabDetailsContainer = styled.div`
    padding: 16px;
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

const TabDetails: React.FC<TabDetailsProps> = ({ ...props }) => {
  const mode = useKlankStore().mode
  const currentTabPath = useKlankStore().tab.path
  const splitTabPath = currentTabPath.split(/[\/\\]/)
  const tabFileName = splitTabPath[splitTabPath.length - 1]
  const tabName = tabFileName?.substring(0, tabFileName.length - 8)
  const tabDetails = useKlankStore().tab.details

  return <TabDetailsContainer {...props}>
    <h1>{tabName}</h1>
    {mode === "Edit" &&
    <textarea></textarea>}
    {mode === "Read" && <p>
      {tabDetails}
    </p>}
  </TabDetailsContainer>
}

export default TabDetails
