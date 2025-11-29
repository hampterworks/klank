import styles from './toolbar.module.css';
import * as React from 'react';
import {
  Button,
  DownloadIcon,
  FolderIcon,
  RefreshIcon,
  SettingsIcon,
  ShuffleIcon,
  TargetIcon,
  ThemeIcon,
  ToolTip,
} from '../../index';

type ToolbarProps = {
} & React.ComponentPropsWithRef<'li'>;

const Toolbar: React.FC<ToolbarProps> = ({ ...props }) => {
  return (
    <li className={styles.container} {...props}>
      <ToolTip message="something">
        <Button iconButton={true} icon={<FolderIcon />} />
      </ToolTip>
      <ToolTip message="something">
        <Button iconButton={true} icon={<RefreshIcon />} />
      </ToolTip>
      <ToolTip message="something">
        <Button iconButton={true} icon={<ThemeIcon />} />
      </ToolTip>
      <ToolTip message="something">
        <Button iconButton={true} icon={<SettingsIcon />} />
      </ToolTip>
      <ToolTip message="something">
        <Button iconButton={true} icon={<TargetIcon />} />
      </ToolTip>
      <ToolTip message="something">
        <Button iconButton={true} icon={<ShuffleIcon />} />
      </ToolTip>
      <ToolTip message="something">
        <Button iconButton={true} icon={<DownloadIcon />} />
      </ToolTip>
    </li>
  );
};

export default Toolbar;
