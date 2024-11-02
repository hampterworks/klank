import * as React from "react";
import styled, {type css} from "styled-components";

const MenuWrapper = styled.ul`
    display: flex;
    gap: 16px;
    position: sticky;
    top: 8px;

    background: rgba(239, 239, 239, 0.95);
    padding: 16px 32px;
    border-radius: 4px;
    width: min-content;
    height: 100px;
    margin-bottom: 32px;

    li {
        display: flex;
        gap: 4px;
        justify-content: flex-start;
        flex-direction: column;

        > span {
            white-space: nowrap;
        }
        > div {
            display: flex;
            gap: 4px;
        }
    }
`

type MenuProps = {
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<'nav'>

const Toolbar: React.FC<MenuProps> = ({children, ...props}) => {
  return <MenuWrapper {...props}>
    {children}
  </MenuWrapper>
}

export default Toolbar
