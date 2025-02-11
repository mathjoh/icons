#!/usr/bin/env node

import { optimize } from "svgo";
import glob from "glob";
import chalk from "chalk";
import path from "path";
import fs from "fs-extra";
import { nanoid } from "nanoid";
import { getElement, getNameAndSize, pascalCase } from './output/util.js'
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { basedir } from "../index.js";

const descriptionsFile = readFileSync(path.join(basedir, 'icon-descriptions.yml'))
const descriptions = yaml.load(descriptionsFile)

const SRC_DIR = path.join(basedir, "raw");
const DIST_DIR = path.join(basedir, "dist");

const svgoPlugins = [
  { name: 'preset-default',
    params: {
      overrides: {
        convertColors: { currentColor: true },
        removeViewBox: false,
        removeTitle: false,
        prefixIds: { delim: "", prefix: nanoid(5), },
      }
    }
  },
  { name: 'sortAttrs' }
]

const files = glob.sync(`${SRC_DIR}/**/*.svg`);

files.forEach((filePath) => {
  try {
    const rawData = fs.readFileSync(filePath, "utf-8");
    if (!rawData) {
      console.log(filePath, "is an empty file, this is bad")
      return
    }
    const dataAsHTMLElement = getElement({ selector: 'div', htmlString: `<div>${rawData}</div>` })
    const { name } = getNameAndSize(filePath)
    const title = descriptions[pascalCase(name)]
    if (title) dataAsHTMLElement.querySelector('svg').prepend(`<title>${title}</title>`)
    const dataWithTitle = dataAsHTMLElement.innerHTML

    const prevFileSize = Buffer.byteLength(dataWithTitle, "utf8");

    const { data: optimizedData } = optimize(dataWithTitle, { plugins: svgoPlugins });

    const optimizedFileSize = Buffer.byteLength(optimizedData, "utf8");

    const fileName = path.basename(filePath);
    const iconSize = getIconSize(filePath);

    console.log(`\n${iconSize}/${fileName}:`);
    printProfitInfo(prevFileSize, optimizedFileSize);

    const outputPath = path.join(DIST_DIR, iconSize, fileName);

    fs.outputFile(outputPath, optimizedData, "utf8");
  } catch (err) {
    console.error(err);
  }
});

/**
 * Copied from https://github.com/svg/svgo/blob/fdf9236d12b861cee926d7ba3f00284ff7884eab/lib/svgo/coa.js#L512
 */
function printProfitInfo(inBytes, outBytes) {
  var profitPercents = 100 - (outBytes * 100) / inBytes;

  console.log(
    Math.round((inBytes / 1024) * 1000) / 1000 +
      " KiB" +
      (profitPercents < 0 ? " + " : " - ") +
      chalk.green(Math.abs(Math.round(profitPercents * 10) / 10) + "%") +
      " = " +
      Math.round((outBytes / 1024) * 1000) / 1000 +
      " KiB"
  );
}

function getIconSize(filePath) {
  const dirname = path.dirname(filePath);
  const dirs = dirname.split("/");
  return dirs[dirs.length - 1];
}
