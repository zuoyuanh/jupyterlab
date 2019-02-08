// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ArrayExt } from '@phosphor/algorithm';
import { JSONValue } from '@phosphor/coreutils';

import { IEditorMimeTypeService } from '@jupyterlab/codeeditor';

import CodeMirror from 'codemirror';

import 'codemirror/mode/meta';
import 'codemirror/addon/runmode/runmode';

import './codemirror-ipython';
import './codemirror-ipythongfm';

// Bundle other common modes
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/css/css';
import 'codemirror/mode/julia/julia';
import 'codemirror/mode/r/r';
import 'codemirror/mode/markdown/markdown';
import 'codemirror/mode/clike/clike';
import 'codemirror/mode/shell/shell';
import 'codemirror/mode/sql/sql';

import { PathExt } from '@jupyterlab/coreutils';

// Stub for the require function.
declare var require: any;

/**
 * The namespace for CodeMirror Mode functionality.
 */
export namespace Mode {
  /**
   * The interface of a codemirror modeInfo spec.
   */
  export interface ISpec {
    ext?: string[];
    name?: string;
    mode: string;
    mime: string;
  }

  /**
   * The interface of a codemirror mode spec.
   */
  export interface IMode {
    name: string;
    [key: string]: JSONValue;
  }

  /**
   * The interface for a codemirror spec resolver.
   */
  export interface ISpecLoader {
    /**
     * A function which returns whether it was successfully loaded
     */
    (spec: ISpec): Promise<boolean>;
  }

  let specLoaders: Private.IRankItem[] = [
    {
      // Simplest, cheapest check by mode name.
      loader: async spec => CodeMirror.modes.hasOwnProperty(spec.mode),
      rank: 0
    },
    {
      // Fetch the mode asynchronously.
      loader: function(spec) {
        return new Promise<boolean>((resolve, reject) => {
          // An arrow function below seems to miscompile in our current webpack to
          // invalid js.
          require([`codemirror/mode/${spec.mode}/${spec.mode}.js`], function() {
            resolve(true);
          });
        });
      },
      rank: 99
    }
  ];

  /**
   * Get the raw list of available modes specs.
   */
  export function getModeInfo(): ISpec[] {
    return CodeMirror.modeInfo;
  }

  /**
   * Running a CodeMirror mode outside of an editor.
   */
  export function run(
    code: string,
    mode: string | ISpec,
    el: HTMLElement
  ): void {
    CodeMirror.runMode(code, mode, el);
  }

  /**
   * Ensure a codemirror mode is available by name or Codemirror spec.
   *
   * @param mode - The mode to ensure.  If it is a string, uses [findBest]
   *   to get the appropriate spec.
   *
   * @returns A promise that resolves when the mode is available.
   */
  export async function ensure(mode: string | ISpec): Promise<ISpec> {
    let spec = findBest(mode);

    for (let specLoader of specLoaders) {
      if (await specLoader.loader(spec)) {
        return spec;
      }
    }

    return null;
  }

  export function addSpecLoader(loader: ISpecLoader, rank: number) {
    let item = { loader, rank };
    let index = ArrayExt.upperBound(specLoaders, item, Private.itemCmp);
    ArrayExt.insert(specLoaders, index, item);
  }

  /**
   * Find a codemirror mode by name or CodeMirror spec.
   */
  export function findBest(mode: string | ISpec): ISpec {
    let modename = typeof mode === 'string' ? mode : mode.mode || mode.name;
    let mimetype = typeof mode !== 'string' ? mode.mime : modename;
    let ext = typeof mode !== 'string' ? mode.ext : [];

    return (
      CodeMirror.findModeByName(modename || '') ||
      CodeMirror.findModeByMIME(mimetype || '') ||
      findByExtension(ext) ||
      CodeMirror.findModeByMIME(IEditorMimeTypeService.defaultMimeType) ||
      CodeMirror.findModeByMIME('text/plain')
    );
  }

  /**
   * Find a codemirror mode by MIME.
   */
  export function findByMIME(mime: string): ISpec {
    return CodeMirror.findModeByMIME(mime);
  }

  /**
   * Find a codemirror mode by name.
   */
  export function findByName(name: string): ISpec {
    return CodeMirror.findModeByName(name);
  }

  /**
   * Find a codemirror mode by filename.
   */
  export function findByFileName(name: string): ISpec {
    let basename = PathExt.basename(name);
    return CodeMirror.findModeByFileName(basename);
  }

  /**
   * Find a codemirror mode by extension.
   */
  export function findByExtension(ext: string | string[]): ISpec {
    if (typeof ext === 'string') {
      return CodeMirror.findModeByExtension(name);
    }
    for (let i = 0; i < ext.length; i++) {
      let mode = CodeMirror.findModeByExtension(ext[i]);
      if (mode) {
        return mode;
      }
    }
  }
}

namespace Private {
  export interface IRankItem {
    /**
     * The loader for the item
     */
    loader: Mode.ISpecLoader;

    /**
     * The sort rank of the widget.
     */
    rank: number;
  }

  /**
   * A less-than comparison function for the loader rank
   */
  export function itemCmp(first: IRankItem, second: IRankItem): number {
    return first.rank - second.rank;
  }
}
