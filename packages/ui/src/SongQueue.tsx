'use client'

import React from "react";
import styled from "styled-components";
import ToolTip from "./ToolTip";

const SongQueueWrapper = styled.li`
    height: max-content;
    border-bottom: 1px solid ${props => props.theme.borderColor};

    ul {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    button {
        cursor: pointer;
    }
    li {
        padding: 8px;
        white-space: nowrap;
        &:nth-child(even) {
            background: ${props => props.theme.secondaryBackground};
        }
    }
`

const QueueHeader = styled.li`
    align-self: center;
`
type SongQueueProps = {
  songQueue: any
  handleFilePathUpdate: (songName: string) => void
} & React.ComponentPropsWithoutRef<'li'>

const SongQueue: React.FC<SongQueueProps> = ({songQueue, handleFilePathUpdate, ...props}) => {
  return <SongQueueWrapper {...props}>
    <ul>
      <QueueHeader>Queue: {songQueue?.list.length ?? '0'} Played: {songQueue?.status.songsPlayedToday ?? '0'}</QueueHeader>
      {
        songQueue?.list.map((item: any) => {
          const songName = `${item.song.artist} - ${item.song.title}`
          return <li key={item.id}>
            <ToolTip message={songName}>
              <button onClick={() => handleFilePathUpdate(songName)}>
                {songName}
              </button>
            </ToolTip>
          </li>;
        })
      }
    </ul>
  </SongQueueWrapper>
}

export default SongQueue
