// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { IObservableJSON } from '@jupyterlab/observables';

import { JSONExt, JSONObject } from '@phosphor/coreutils';

import { Message } from '@phosphor/messaging';

import { Widget } from '@phosphor/widgets';

import { CodeEditor } from './editor';

/**
 * The class name added to a JSONEditor instance.
 */
const JSONEDITOR_CLASS = 'jp-JSONEditor';

/**
 * The class name added when the Metadata editor contains invalid JSON.
 */
const ERROR_CLASS = 'jp-mod-error';

/**
 * The class name added to the editor host node.
 */
const HOST_CLASS = 'jp-JSONEditor-host';

/**
 * The class name added to the header area.
 */
const HEADER_CLASS = 'jp-JSONEditor-header';

/**
 * The class name added to the title node.
 */
const TITLE_CLASS = 'jp-JSONEditor-title';

/**
 * The class name added to the collapser node.
 */
const COLLAPSER_CLASS = 'jp-JSONEditor-collapser';

/**
 * The class name added to the collapser node that is enabled.
 */
const COLLAPSE_ENABLED_CLASS = 'jp-mod-collapse-enabled';

/**
 * The class name added to the revert button.
 */
const REVERT_CLASS = 'jp-JSONEditor-revertButton';

/**
 * The class name added to the commit button.
 */
const COMMIT_CLASS = 'jp-JSONEditor-commitButton';

/**
 * The class name added to collapsed items.
 */
const COLLAPSED_CLASS = 'jp-mod-collapsed';

/**
 * A widget for editing observable JSON.
 */
export class JSONEditor extends Widget {
  /**
   * Construct a new JSON editor.
   */
  constructor(options: JSONEditor.IOptions) {
    super();

    this.addClass(JSONEDITOR_CLASS);

    this.headerNode = document.createElement('div');
    this.headerNode.className = HEADER_CLASS;

    this.titleNode = document.createElement('span');
    this.titleNode.className = TITLE_CLASS;
    this.titleNode.textContent = options.title || '';

    this.collapserNode = document.createElement('span');
    this.collapserNode.className = COLLAPSER_CLASS;
    if (options.collapsible) {
      this.collapserNode.classList.add(COLLAPSE_ENABLED_CLASS);
    }

    this.revertButtonNode = document.createElement('span');
    this.revertButtonNode.className = REVERT_CLASS;
    this.revertButtonNode.title = 'Revert changes to data';

    this.commitButtonNode = document.createElement('span');
    this.commitButtonNode.className = COMMIT_CLASS;
    this.commitButtonNode.title = 'Commit changes to data';

    this.editorHostNode = document.createElement('div');
    this.editorHostNode.className = HOST_CLASS;

    this.headerNode.appendChild(this.titleNode);
    this.headerNode.appendChild(this.collapserNode);
    this.headerNode.appendChild(this.revertButtonNode);
    this.headerNode.appendChild(this.commitButtonNode);

    this.node.appendChild(this.headerNode);
    this.node.appendChild(this.editorHostNode);

    let model = new CodeEditor.Model();

    model.value.text = 'No data!';
    model.mimeType = 'application/json';
    model.value.changed.connect(
      this._onValueChanged,
      this
    );
    this.model = model;
    this.editor = options.editorFactory({ host: this.editorHostNode, model });
    this.editor.setOption('readOnly', true);
    this.collapsible = !!options.collapsible;
  }

  /**
   * The code editor used by the editor.
   */
  readonly editor: CodeEditor.IEditor;

  /**
   * The code editor model used by the editor.
   */
  readonly model: CodeEditor.IModel;

  /**
   * Whether the editor is collapsible.
   */
  readonly collapsible: boolean;

  /**
   * The editor host node used by the JSON editor.
   */
  readonly headerNode: HTMLDivElement;

  /**
   * The editor host node used by the JSON editor.
   */
  readonly editorHostNode: HTMLDivElement;

  /**
   * The title node used by the JSON editor.
   */
  readonly titleNode: HTMLSpanElement;

  /**
   * Get the collapser node used by the JSON editor.
   */
  readonly collapserNode: HTMLSpanElement;

  /**
   * The revert button used by the JSON editor.
   */
  readonly revertButtonNode: HTMLSpanElement;

  /**
   * The commit button used by the JSON editor.
   */
  readonly commitButtonNode: HTMLSpanElement;

  /**
   * The title of the editor.
   */
  get editorTitle(): string {
    return this.titleNode.textContent || '';
  }
  set editorTitle(value: string) {
    this.titleNode.textContent = value;
  }

  /**
   * The observable source.
   */
  get source(): IObservableJSON | null {
    return this._source;
  }
  set source(value: IObservableJSON | null) {
    if (this._source === value) {
      return;
    }
    if (this._source) {
      this._source.changed.disconnect(this._onSourceChanged, this);
    }
    this._source = value;
    this.editor.setOption('readOnly', value === null);
    if (value) {
      value.changed.connect(
        this._onSourceChanged,
        this
      );
    }
    this._setValue();
  }

  /**
   * Get whether the editor is dirty.
   */
  get isDirty(): boolean {
    return this._dataDirty || this._inputDirty;
  }

  /**
   * Handle the DOM events for the widget.
   *
   * @param event - The DOM event sent to the widget.
   *
   * #### Notes
   * This method implements the DOM `EventListener` interface and is
   * called in response to events on the notebook panel's node. It should
   * not be called directly by user code.
   */
  handleEvent(event: Event): void {
    switch (event.type) {
      case 'blur':
        this._evtBlur(event as FocusEvent);
        break;
      case 'click':
        this._evtClick(event as MouseEvent);
        break;
      default:
        break;
    }
  }

  /**
   * Handle `after-attach` messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    let node = this.editorHostNode;
    node.addEventListener('blur', this, true);
    node.addEventListener('click', this, true);
    this.revertButtonNode.hidden = true;
    this.commitButtonNode.hidden = true;
    this.headerNode.addEventListener('click', this);
    if (this.isVisible) {
      this.update();
    }
  }

  /**
   * Handle `after-show` messages for the widget.
   */
  protected onAfterShow(msg: Message): void {
    this.update();
  }

  /**
   * Handle `update-request` messages for the widget.
   */
  protected onUpdateRequest(msg: Message): void {
    this.editor.refresh();
  }

  /**
   * Handle `before-detach` messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    let node = this.editorHostNode;
    node.removeEventListener('blur', this, true);
    node.removeEventListener('click', this, true);
    this.headerNode.removeEventListener('click', this);
  }

  /**
   * Handle a change to the metadata of the source.
   */
  private _onSourceChanged(
    sender: IObservableJSON,
    args: IObservableJSON.IChangedArgs
  ) {
    if (this._changeGuard) {
      return;
    }
    if (this._inputDirty || this.editor.hasFocus()) {
      this._dataDirty = true;
      return;
    }
    this._setValue();
  }

  /**
   * Handle change events.
   */
  private _onValueChanged(): void {
    let valid = true;
    try {
      let value = JSON.parse(this.editor.model.value.text);
      this.removeClass(ERROR_CLASS);
      this._inputDirty =
        !this._changeGuard && !JSONExt.deepEqual(value, this._originalValue);
    } catch (err) {
      this.addClass(ERROR_CLASS);
      this._inputDirty = true;
      valid = false;
    }
    this.revertButtonNode.hidden = !this._inputDirty;
    this.commitButtonNode.hidden = !valid || !this._inputDirty;
  }

  /**
   * Handle blur events for the text area.
   */
  private _evtBlur(event: FocusEvent): void {
    // Update the metadata if necessary.
    if (!this._inputDirty && this._dataDirty) {
      this._setValue();
    }
  }

  /**
   * Handle click events for the buttons.
   */
  private _evtClick(event: MouseEvent): void {
    let target = event.target as HTMLElement;
    switch (target) {
      case this.revertButtonNode:
        this._setValue();
        break;
      case this.commitButtonNode:
        if (!this.commitButtonNode.hidden && !this.hasClass(ERROR_CLASS)) {
          this._changeGuard = true;
          this._mergeContent();
          this._changeGuard = false;
          this._setValue();
        }
        break;
      case this.titleNode:
      case this.collapserNode:
        if (this.collapsible) {
          let collapser = this.collapserNode;
          if (collapser.classList.contains(COLLAPSED_CLASS)) {
            collapser.classList.remove(COLLAPSED_CLASS);
            this.editorHostNode.classList.remove(COLLAPSED_CLASS);
          } else {
            collapser.classList.add(COLLAPSED_CLASS);
            this.editorHostNode.classList.add(COLLAPSED_CLASS);
          }
        }
        break;
      case this.editorHostNode:
        this.editor.focus();
        break;
      default:
        break;
    }
  }

  /**
   * Merge the user content.
   */
  private _mergeContent(): void {
    let model = this.editor.model;
    let current = this._source ? this._source.toJSON() : {};
    let old = this._originalValue;
    let user = JSON.parse(model.value.text) as JSONObject;
    let source = this.source;
    if (!source) {
      return;
    }

    // If it is in user and has changed from old, set in current.
    for (let key in user) {
      if (!JSONExt.deepEqual(user[key], old[key] || null)) {
        current[key] = user[key];
      }
    }
    // If it was in old and is not in user, remove from current.
    for (let key in old) {
      if (!(key in user)) {
        delete current[key];
        source.delete(key);
      }
    }
    // Set the values.
    for (let key in current) {
      source.set(key, current[key]);
    }
  }

  /**
   * Set the value given the owner contents.
   */
  private _setValue(): void {
    this._dataDirty = false;
    this._inputDirty = false;
    this.revertButtonNode.hidden = true;
    this.commitButtonNode.hidden = true;
    this.removeClass(ERROR_CLASS);
    let model = this.editor.model;
    let content = this._source ? this._source.toJSON() : {};
    this._changeGuard = true;
    if (content === void 0) {
      model.value.text = 'No data!';
      this._originalValue = JSONExt.emptyObject;
    } else {
      let value = JSON.stringify(content, null, 4);
      model.value.text = value;
      this._originalValue = content;
      // Move the cursor to within the brace.
      if (value.length > 1 && value[0] === '{') {
        this.editor.setCursorPosition({ line: 0, column: 1 });
      }
    }
    this.editor.refresh();
    this._changeGuard = false;
    this.commitButtonNode.hidden = true;
    this.revertButtonNode.hidden = true;
  }

  private _dataDirty = false;
  private _inputDirty = false;
  private _source: IObservableJSON | null = null;
  private _originalValue = JSONExt.emptyObject;
  private _changeGuard = false;
}

/**
 * The static namespace JSONEditor class statics.
 */
export namespace JSONEditor {
  /**
   * The options used to initialize a json editor.
   */
  export interface IOptions {
    /**
     * The editor factory used by the editor.
     */
    editorFactory: CodeEditor.Factory;

    /**
     * The title of the editor. Defaults to an empty string.
     */
    title?: string;

    /**
     * Whether the title should be collapsible. Defaults to `false`.
     */
    collapsible?: boolean;
  }
}
