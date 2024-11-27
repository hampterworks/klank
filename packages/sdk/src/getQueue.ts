const getQueue = async (streamerSongListUser: string) => {

  if (streamerSongListUser === undefined || streamerSongListUser === null || streamerSongListUser === "")
    return

  return await fetch(`https://api.streamersonglist.com/v1/streamers/${streamerSongListUser}/queue`)
}

export default getQueue
