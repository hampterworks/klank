import * as React from "react";
import styled, {type css} from "styled-components";

const MenuWrapper = styled.ul`
    display: flex;
    gap: 16px;
    position: sticky;
    top: 0;
    color: ${props => props.theme.textColor};
    background: ${props => props.theme.secondaryBackground};

    padding: 16px 32px;
    height: 100px;
    margin-bottom: 32px;

    li {
        > span {
            display: block;
            white-space: nowrap;
            margin-bottom: 4px;
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
