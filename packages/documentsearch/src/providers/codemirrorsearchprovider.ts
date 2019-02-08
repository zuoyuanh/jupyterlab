// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

/*
  Parts of the implementation of the search in this file were derived from
  CodeMirror's search at:
  https://github.com/codemirror/CodeMirror/blob/c2676685866c571a1c9c82cb25018cc08b4d42b2/addon/search/search.js
  which is licensed with the following license:

  MIT License

  Copyright (C) 2017 by Marijn Haverbeke <marijnh@gmail.com> and others

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
*/

import { ISearchProvider, ISearchMatch } from '../interfaces';

import { MainAreaWidget } from '@jupyterlab/apputils';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { ISignal, Signal } from '@phosphor/signaling';
import { Widget } from '@phosphor/widgets';

import * as CodeMirror from 'codemirror';
import { FileEditor } from '@jupyterlab/fileeditor';

type MatchMap = { [key: number]: { [key: number]: ISearchMatch } };

export class CodeMirrorSearchProvider implements ISearchProvider {
  /**
   * Initialize the search using the provided options.  Should update the UI
   * to highlight all matches and "select" whatever the first match should be.
   *
   * @param query A RegExp to be use to perform the search
   * @param searchTarget The widget to be searched
   *
   * @returns A promise that resolves with a list of all matches
   */
  async startQuery(
    query: RegExp,
    searchTarget: Widget
  ): Promise<ISearchMatch[]> {
    if (!CodeMirrorSearchProvider.canSearchOn(searchTarget)) {
      throw new Error('Cannot find Codemirror instance to search');
    }

    // Extract the codemirror object from the editor widget. Each of these casts
    // is justified by the canSearchOn call above.
    let target = searchTarget as MainAreaWidget;
    let content = target.content as FileEditor;
    this._cm = content.editor as CodeMirrorEditor;
    return this._startQuery(query);
  }

  /**
   * Initialize the search using a CodeMirrorEditor object.
   */
  async startQueryCodeMirror(
    query: RegExp,
    searchTarget: CodeMirrorEditor
  ): Promise<ISearchMatch[]> {
    this._cm = searchTarget;
    return this._startQuery(query);
  }

  private async _startQuery(query: RegExp): Promise<ISearchMatch[]> {
    await this.endQuery();

    this._query = query;

    CodeMirror.on(this._cm.doc, 'change', this._onDocChanged.bind(this));
    this._refreshOverlay();
    this._setInitialMatches(query);

    const matches = this._parseMatchesFromState();
    if (matches.length === 0) {
      return [];
    }
    if (!this.isSubProvider) {
      const cursorMatch = this._findNext(false);
      const match = this._matchState[cursorMatch.from.line][
        cursorMatch.from.ch
      ];
      this._matchIndex = match.index;
    }
    return matches;
  }

  /**
   * Clears state of a search provider to prepare for startQuery to be called
   * in order to start a new query or refresh an existing one.
   *
   * @returns A promise that resolves when the search provider is ready to
   * begin a new search.
   */
  async endQuery(): Promise<void> {
    this._matchState = {};
    this._matchIndex = null;
    this._cm.removeOverlay(this._overlay);
    CodeMirror.off(this._cm.doc, 'change', this._onDocChanged.bind(this));
  }

  /**
   * Resets UI state, removes all matches.
   *
   * @returns A promise that resolves when all state has been cleaned up.
   */
  async endSearch(): Promise<void> {
    if (!this.isSubProvider) {
      this._cm.focus();
    }
    this.endQuery();
  }

  /**
   * Move the current match indicator to the next match.
   *
   * @returns A promise that resolves once the action has completed.
   */
  async highlightNext(): Promise<ISearchMatch | undefined> {
    const cursorMatch = this._findNext(false);
    if (!cursorMatch) {
      return;
    }
    const match = this._matchState[cursorMatch.from.line][cursorMatch.from.ch];
    this._matchIndex = match.index;
    return match;
  }

  /**
   * Move the current match indicator to the previous match.
   *
   * @returns A promise that resolves once the action has completed.
   */
  async highlightPrevious(): Promise<ISearchMatch | undefined> {
    const cursorMatch = this._findNext(true);
    if (!cursorMatch) {
      return;
    }
    const match = this._matchState[cursorMatch.from.line][cursorMatch.from.ch];
    this._matchIndex = match.index;
    return match;
  }

  /**
   * Report whether or not this provider has the ability to search on the given object
   */
  static canSearchOn(domain: Widget): boolean {
    return (
      domain instanceof MainAreaWidget &&
      domain.content instanceof FileEditor &&
      domain.content.editor instanceof CodeMirrorEditor
    );
  }

  /**
   * The same list of matches provided by the startQuery promise resoluton
   */
  get matches(): ISearchMatch[] {
    return this._parseMatchesFromState();
  }

  /**
   * Signal indicating that something in the search has changed, so the UI should update
   */
  get changed(): ISignal<this, void> {
    return this._changed;
  }

  /**
   * The current index of the selected match.
   */
  get currentMatchIndex(): number {
    return this._matchIndex;
  }

  clearSelection(): void {
    return null;
  }

  /**
   * Set whether or not the CodemirrorSearchProvider will wrap to the beginning
   * or end of the document on invocations of highlightNext or highlightPrevious, respectively
   */
  isSubProvider = false;

  private _onDocChanged(_: any, changeObj: CodeMirror.EditorChange) {
    // If we get newlines added/removed, the line numbers across the
    // match state are all shifted, so here we need to recalculate it
    if (changeObj.text.length > 1 || changeObj.removed.length > 1) {
      this._setInitialMatches(this._query);
      this._changed.emit(undefined);
    }
  }

  private _refreshOverlay() {
    this._cm.operation(() => {
      // clear search first
      this._cm.removeOverlay(this._overlay);
      this._overlay = this._getSearchOverlay();
      this._cm.addOverlay(this._overlay);
      this._changed.emit(null);
    });
  }

  /**
   * Do a full search on the entire document.
   *
   * This manually constructs the initial match state across the whole
   * document. This must be done manually because the codemirror overlay
   * is lazy-loaded, so it will only tokenize lines that are in or near
   * the viewport.  This is sufficient for efficiently maintaining the
   * state when changes are made to the document, as changes occur in or
   * near the viewport, but to scan the whole document, a manual search
   * across the entire content is required.
   *
   * @param query The search term
   */
  private _setInitialMatches(query: RegExp) {
    this._matchState = {};

    const start = CodeMirror.Pos(this._cm.doc.firstLine(), 0);
    const end = CodeMirror.Pos(this._cm.doc.lastLine());
    const content = this._cm.doc.getRange(start, end);
    const lines = content.split('\n');
    let totalMatchIndex = 0;
    lines.forEach((line, lineNumber) => {
      query.lastIndex = 0;
      let match = query.exec(line);
      while (match) {
        const col = match.index;
        const matchObj: ISearchMatch = {
          text: match[0],
          line: lineNumber,
          column: col,
          fragment: line,
          index: totalMatchIndex
        };
        if (!this._matchState[lineNumber]) {
          this._matchState[lineNumber] = {};
        }
        this._matchState[lineNumber][col] = matchObj;
        match = query.exec(line);
      }
    });
  }

  private _getSearchOverlay() {
    return {
      /**
       * Token function is called when a line needs to be processed -
       * when the overlay is intially created, it's called on all lines;
       * when a line is modified and needs to be re-evaluated, it's called
       * on just that line.
       *
       * This implementation of the token function both constructs/maintains
       * the overlay and keeps track of the match state as the document is
       * updated while a search is active.
       */
      token: (stream: CodeMirror.StringStream) => {
        const currentPos = stream.pos;
        this._query.lastIndex = currentPos;
        const lineText = stream.string;
        const match = this._query.exec(lineText);
        const line = (stream as any).lineOracle.line;

        // If starting at position 0, the tokenization of this line has just started.
        // Blow away everything on this line in the state so it can be updated.
        if (
          stream.start === currentPos &&
          currentPos === 0 &&
          !!this._matchState[line]
        ) {
          this._matchState[line] = {};
        }
        if (match && match.index === currentPos) {
          // found match, add it to state
          const matchLength = match[0].length;
          const matchObj: ISearchMatch = {
            text: lineText.substr(currentPos, matchLength),
            line: line,
            column: currentPos,
            fragment: lineText,
            index: 0 // fill in index when flattening, later
          };
          if (!this._matchState[line]) {
            this._matchState[line] = {};
          }
          this._matchState[line][currentPos] = matchObj;
          // move the stream along and return searching style for the token
          stream.pos += matchLength || 1;

          // if the last thing on the line was a match, make sure we still
          // emit the changed signal so the display can pick up the updates
          if (stream.eol) {
            this._changed.emit(undefined);
          }
          return 'searching';
        } else if (match) {
          // there's a match in the stream, advance the stream to its position
          stream.pos = match.index;
        } else {
          // no matches, consume the rest of the stream
          this._changed.emit(undefined);
          stream.skipToEnd();
        }
      }
    };
  }

  private _findNext(reverse: boolean): Private.ICodeMirrorMatch {
    return this._cm.operation(() => {
      const caseSensitive = this._query.ignoreCase;
      const cursorToGet = reverse ? 'from' : 'to';
      const lastPosition = this._cm.getCursor(cursorToGet);
      const position = this._toEditorPos(lastPosition);
      let cursor: CodeMirror.SearchCursor = this._cm.getSearchCursor(
        this._query,
        lastPosition,
        !caseSensitive
      );
      if (!cursor.find(reverse)) {
        // if we don't want to loop, no more matches found, reset the cursor and exit
        if (this.isSubProvider) {
          this._cm.setCursorPosition(position);
          this._matchIndex = null;
          return null;
        }

        // if we do want to loop, try searching from the bottom/top
        const startOrEnd = reverse
          ? CodeMirror.Pos(this._cm.lastLine())
          : CodeMirror.Pos(this._cm.firstLine(), 0);
        cursor = this._cm.getSearchCursor(
          this._query,
          startOrEnd,
          !caseSensitive
        );
        if (!cursor.find(reverse)) {
          return null;
        }
      }
      const fromPos: CodeMirror.Position = cursor.from();
      const toPos: CodeMirror.Position = cursor.to();
      const selRange: CodeEditor.IRange = {
        start: {
          line: fromPos.line,
          column: fromPos.ch
        },
        end: {
          line: toPos.line,
          column: toPos.ch
        }
      };

      this._cm.setSelection(selRange);
      this._cm.scrollIntoView(
        {
          from: fromPos,
          to: toPos
        },
        100
      );
      return {
        from: fromPos,
        to: toPos
      };
    });
  }

  private _parseMatchesFromState(): ISearchMatch[] {
    let index = 0;
    // Flatten state map and update the index of each match
    const matches: ISearchMatch[] = Object.keys(this._matchState).reduce(
      (result: ISearchMatch[], lineNumber: string) => {
        const lineKey = parseInt(lineNumber, 10);
        const lineMatches: { [key: number]: ISearchMatch } = this._matchState[
          lineKey
        ];
        Object.keys(lineMatches).forEach((pos: string) => {
          const posKey = parseInt(pos, 10);
          const match: ISearchMatch = lineMatches[posKey];
          match.index = index;
          index += 1;
          result.push(match);
        });
        return result;
      },
      []
    );
    return matches;
  }

  private _toEditorPos(posIn: CodeMirror.Position): CodeEditor.IPosition {
    return {
      line: posIn.line,
      column: posIn.ch
    };
  }

  private _query: RegExp;
  private _cm: CodeMirrorEditor;
  private _matchIndex: number;
  private _matchState: MatchMap = {};
  private _changed = new Signal<this, void>(this);
  private _overlay: any;
}

export class SearchState {
  public posFrom: CodeMirror.Position;
  public posTo: CodeMirror.Position;
  public lastQuery: string;
  public query: RegExp;
}

namespace Private {
  export interface ICodeMirrorMatch {
    from: CodeMirror.Position;
    to: CodeMirror.Position;
  }
}
