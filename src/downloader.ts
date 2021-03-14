import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import {SemVer} from 'semver'
import {getLinks} from './links/getLinks'
import {AbstractLinks} from './links/links'
import {getOs, OSType} from './platform'
import fs from 'fs'

// Download helper which returns the installer executable and caches it for next runs
export async function download(version: SemVer): Promise<string> {
  // First try to find tool with desired version in tool cache
  const toolName = 'cuda_installer'
  const toolPath = tc.find(toolName, `${version}`)
  // Path that contains the executable file
  let executablePath: string
  if (toolPath) {
    // Tool is already in cache
    core.debug(`Found in cache ${toolPath}`)
    executablePath = toolPath
  } else {
    core.debug(`Not found in cache, downloading...`)
    // Get download URL
    const links: AbstractLinks = await getLinks()
    const url: URL = links.getURLFromCudaVersion(version)
    // Get intsaller filename extension depending on OS
    let fileExtension: string
    const osType = await getOs()
    switch (osType) {
      case OSType.windows:
        fileExtension = 'exe'
        break
      case OSType.linux:
        fileExtension = 'run'
        break
    }
    // Pathname for destination
    const destFileName = `${toolName}_${version}.${fileExtension}`
    // Download executable
    const path: string = await tc.downloadTool(url.toString(), destFileName)
    // Cache download
    const cachedPath = await tc.cacheFile(
      path,
      destFileName,
      toolName,
      `${version}`
    )
    executablePath = cachedPath
  }
  // String with full executable path
  let fullExecutablePath: string
  // Get list of files in tool cache
  const filesInCache = await fs.promises.readdir(executablePath)
  if (filesInCache.length > 1) {
    throw new Error(`Got multiple file in tool cache: ${filesInCache.length}`)
  } else if (filesInCache.length === 0) {
    throw new Error(`Got no files in tool cahce`)
  } else {
    fullExecutablePath = filesInCache[0]
  }
  // Make file executable on linux
  if ((await getOs()) === OSType.linux) {
    // 0755 octal notation permission is: owner(r,w,x), group(r,w,x), other(r,x) where r=read, w=write, x=execute
    await fs.promises.chmod(fullExecutablePath, '0755')
  }
  // Return full executable path
  return fullExecutablePath
}
