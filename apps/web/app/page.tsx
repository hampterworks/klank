
import styles from "./page.module.css";
import React from "react";
import Application from "../../../packages/ui/src/Application";


export default async function Home() {
  return <Application className={styles.main}/>
}
