import { fileURLToPath } from 'url';
import { readFile } from 'fs';
import { promisify } from 'util';
import path, { join } from 'path';
// import svgToMiniDataURI from 'mini-svg-data-uri';
import { Options, StylesLang, SvgMapObject } from '../types';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SvgDataUriMapObject {
  width: number;
  height: number;
  viewbox: number[];
  source?: string;
}

export class Styles {
  private _svgs: Map<string, SvgDataUriMapObject>;
  private _options: Options;

  constructor(svgs: Map<string, SvgMapObject>, options: Options) {
    this._svgs = new Map();
    this._options = options;

    svgs.forEach((svg, name) => {
      // const svgDataUri = svgToMiniDataURI(svg.source);

      this._svgs.set(name, {
        width: svg.width,
        height: svg.height,
        viewbox: svg.viewBox,
        source: svg.source,
      });
    });
  }

  protected createSpriteMap(
    generator: (
      name: string,
      svg: SvgDataUriMapObject,
      isLast: boolean
    ) => string
  ): string {
    let spriteMap = '';
    let index = 1;
    this._svgs.forEach((svg, name) => {
      spriteMap += `${generator(name, svg, index === this._svgs.size)}\n`;
      index++;
    });
    return spriteMap;
  }

  private async insert(insert: string, lang: StylesLang): Promise<string> {
    if (!this._options.styles) return '';
    const template = await promisify(readFile)(
      join(__dirname, `/template.${lang}`),
      'utf8'
    );

    const doNotEditThisFile = '/* Generated by svg-spritemap */\n';

    return doNotEditThisFile + insert + '\n' + template;
  }

  // SCSS generation
  private _generate_scss() {
    let insert = `@use 'sass:map';
$sprites-prefix: '${this._options.prefix}';\n`;

    insert += '$sprites: (\n';
    insert += this.createSpriteMap((name, svg, isLast) => {
      let sprites = '';
      sprites = `\t'${name}': (`;
      sprites += `\n\t\turi: 'data:image/svg+xml;utf8,${svg.source}',`;
      sprites += `\n\t\twidth: ${svg.width}px,`;
      sprites += `\n\t\theight: ${svg.height}px`;
      sprites += `\n\t${!isLast ? '),' : ')'}`;
      return sprites;
    });
    insert += ');\n';

    return insert;
  }

  // Styl generation
  private _generate_styl() {
    let insert = `$sprites-prefix = '${this._options.prefix}'\n`;

    insert += '$sprites = {\n';
    insert += this.createSpriteMap((name, svg, isLast) => {
      let sprites = '';
      sprites = `\t'${name}': {`;
      sprites += `\n\t\turi: 'data:image/svg+xml;utf8,${svg.source}',`;
      sprites += `\n\t\twidth: ${svg.width}px,`;
      sprites += `\n\t\theight: ${svg.height}px`;
      sprites += `\n\t${!isLast ? '},' : '}'}`;
      return sprites;
    });
    insert += '}\n';

    return insert;
  }

  // Less generation
  private _generate_less() {
    let insert = `@sprites-prefix: '${this._options.prefix}';\n`;

    insert += '@sprites: {\n';
    insert += this.createSpriteMap((name, svg) => {
      let sprites = '';
      sprites = `\t@${name}: {`;
      sprites += `\n\t\turi: 'data:image/svg+xml;utf8,${svg.source}';`;
      sprites += `\n\t\twidth: ${svg.width}px;`;
      sprites += `\n\t\theight: ${svg.height}px;`;
      sprites += `\n\t};`;
      return sprites;
    });
    insert += '}\n';

    return insert;
  }

  // CSS generation
  private _generate_css() {
    let insert = this.createSpriteMap((name, svg) => {
      let sprites = '';
      sprites = `.${this._options.prefix + name} {`;
      sprites += `\n\t--icon: url('data:image/svg+xml;utf8,${svg.source}');`;
      sprites += `\n}`;
      return sprites;
    });

    if (this._options.output && this._options.output.view) {
      insert += this.createSpriteMap((name) => {
        let sprites = '';
        sprites = `.${this._options.prefix + name}-frag {`;
        sprites += `\n\tmask-image: url('/__spritemap#${
          this._options.prefix + name
        }-view') center no-repeat;`;
        sprites += `\n}`;
        return sprites;
      });
    }

    return insert;
  }

  public generate(): Map<string, Promise<string>> {
    const result = new Map<string, Promise<string>>();
    if (!this._options.styles) return result;

    this._options.styles.forEach((entry) => {
      let insert: string;

      switch (entry.lang) {
        case 'scss':
          insert = this._generate_scss();
          break;
        case 'styl':
          insert = this._generate_styl();
          break;
        case 'less':
          insert = this._generate_less();
          break;
        case 'css':
        default:
          insert = this._generate_css();
      }

      result.set(entry.filename, this.insert(insert, entry.lang));
    });

    return result;
  }
}
