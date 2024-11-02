import * as React from "react";
import styled from "styled-components";
import useKlankStore from "web/state/store";

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
  return <TabDetailsContainer {...props}>
    <h1>Test</h1>
    <h2>Artist Name</h2>
    {mode === "Edit" &&
    <textarea></textarea>}
    {mode === "Read" && <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
    </p>}
  </TabDetailsContainer>
}

export default TabDetails
