import React, {useEffect, useState} from "react";
import Typography from "./Typography";
import Button from "./Button";
import {
    checkGitCleanState,
    checkGitFolder,
    checkUnpushedCommits,
    commitChanges,
    getChangedFiles,
    GitChanges,
    pullChanges,
    pushChanges
} from "@repo/sdk/git";
import useKlankStore from "web/state/store";
import styles from './GitController.module.css'

const GitController: React.FC = () => {
    const baseDirectory = useKlankStore().baseDirectory
    const [isGitFolder, setIsGitFolder] = useState<boolean>(false)
    const [isGitClean, setIsGiClean] = useState<boolean>(true)
    const [isGitUnpushedCommits, setIsGitUnpushedCommits] = useState<boolean>(false)
    const [gitState, setGitState] = useState<string>('')
    const [gitChanges, setGitChanges] = useState<GitChanges | null>(null)

    const refreshGitState = async () => {
        if (isGitFolder) {
            const cleanState = await checkGitCleanState(baseDirectory ?? '')
            setIsGiClean(cleanState.isClean);
            
            if (!cleanState.isClean) {
                const changedFiles = await getChangedFiles(baseDirectory ?? '')
                setGitChanges(changedFiles.changes ?? null)
            } else {
                setGitChanges(null)
            }

            const unpushedState = await checkUnpushedCommits(baseDirectory ?? '')
            setIsGitUnpushedCommits(unpushedState.hasUnpushedCommits)
        }
    };

    useEffect(() => {
        const checkGit = async () =>
            await checkGitFolder(baseDirectory ?? '')

        checkGit().then(result => setIsGitFolder(result))
    }, [])

    useEffect(() => {
        if (isGitFolder) {
            refreshGitState()
        }
        return
    }, [isGitFolder])

    return <section className={styles.container}>
        <Typography variant='h3' component='h2'>Git</Typography>
        <Typography variant='h4' component='h3'>{isGitFolder ? 'Git folder found' : 'Git folder not found'}</Typography>
        {
            isGitFolder &&
            <>
                <Typography variant='h4' component='h3'>{isGitClean ? 'Git folder clean' : 'Git folder not clean'}</Typography>
                <span>{gitState}</span>
                <div>
                    {
                        gitChanges?.staged && gitChanges.staged.length > 0 && <>
                            <Typography variant='h5' component='h4'>staged changes</Typography>
                            {
                                gitChanges.staged.map(file => <div key={file}>{file}</div>)
                            }
                        </>
                    }
                </div>
                {
                    gitChanges?.unstaged && gitChanges.unstaged.length > 0 && <>
                        <Typography variant='h5' component='h4'>unstaged changes</Typography>
                        {gitChanges.unstaged.map(file => <div key={file}>{file}</div>)}
                    </>
                }
                {
                    gitChanges?.untracked && gitChanges.untracked.length > 0 && <>
                        <Typography variant='h5' component='h4'>untracked files</Typography>
                        {gitChanges.untracked.map(file => <div key={file}>{file}</div>)}
                    </>
                }
                <Button
                    label='Pull changes'
                    onClick={() => {
                        pullChanges(baseDirectory ?? '').then(result => setGitState(result.status))
                    }}
                    disabled={!isGitFolder}
                />
                <Button
                    label='commit changes'
                    onClick={() => {
                        commitChanges(baseDirectory ?? '').then(result => {
                            if (result.success) {
                                setIsGitUnpushedCommits(true)
                                refreshGitState()
                            }
                            setGitState(result.status)
                        })
                    }}
                    disabled={isGitClean}
                />
                <Button
                    label='push changes'
                    onClick={async () => {
                        const result = await pushChanges(baseDirectory ?? '')
                        if (result.success) {
                            setIsGitUnpushedCommits(false)
                            await refreshGitState()
                        }
                        setGitState(result.status)
                    }}
                    disabled={!isGitFolder || !isGitUnpushedCommits}
                />
            </>
        }
    </section>
}

export default GitController