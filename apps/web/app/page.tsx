import Application from "@repo/ui/Application";
import styles from "./page.module.css";
import React from "react";


export default async function Home() {
  return <Application className={styles.main}/>
}
