// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  showErrorMessage,
  VDomModel,
  VDomRenderer
} from '@jupyterlab/apputils';

import { ISettingRegistry } from '@jupyterlab/coreutils';

import {
  // ArrayExt,
  ArrayIterator,
  IIterator,
  map,
  each,
  toArray
} from '@phosphor/algorithm';

import { CommandRegistry } from '@phosphor/commands';

import {
  Token,
  ReadonlyJSONObject,
  JSONValue,
  JSONObject
} from '@phosphor/coreutils';

import { DisposableDelegate, IDisposable } from '@phosphor/disposable';

import { AttachedProperty } from '@phosphor/properties';

import { Widget } from '@phosphor/widgets';

import * as React from 'react';

import '../style/index.css';

/**
 * The class name added to Launcher instances.
 */
const LAUNCHER_CLASS = 'jp-Launcher';

/**
 * The known categories of launcher items and their default ordering.
 */
const KNOWN_CATEGORIES = ['Environment', 'Other'];

/**
 * These launcher item categories are known to have kernels, so the kernel icons
 * are used.
 */
// const KERNEL_CATEGORIES = ['Environment'];

/* tslint:disable */
/**
 * The launcher token.
 */
export const ILauncher = new Token<ILauncher>('@jupyterlab/launcher:ILauncher');
/* tslint:enable */

/**
 * The launcher interface.
 */
export interface ILauncher {
  /**
   * Add a command item to the launcher, and trigger re-render event for parent
   * widget.
   *
   * @param options - The specification options for a launcher item.
   *
   * @returns A disposable that will remove the item from Launcher, and trigger
   * re-render event for parent widget.
   *
   */
  add(options: ILauncher.IItemOptions): IDisposable;
}

/**
 * IUsageData records the count of usage and the most recent date of usage
 * for a certain kernel or card.
 */
interface IUsageData {
  /**
   * Count the number that a certain card is used.
   */
  usageCount: number;
  /**
   * The most recent timestamp a certain card is used.
   */
  mostRecentUsage: string;
}

/**
 * LauncherModel keeps track of the path to working directory and has a list of
 * LauncherItems, which the Launcher will render.
 */
export class LauncherModel extends VDomModel implements ILauncher {
  /**
   * Create a new launcher model.
   */
  constructor() {
    super();
  }

  /**
   * Add a command item to the launcher, and trigger re-render event for parent
   * widget.
   *
   * @param options - The specification options for a launcher item.
   *
   * @returns A disposable that will remove the item from Launcher, and trigger
   * re-render event for parent widget.
   *
   */
  add(options: ILauncher.IItemOptions): IDisposable {
    // Create a copy of the options to circumvent mutations to the original.
    let item = {
      ...options,
      category: options.category || '',
      rank: options.rank !== undefined ? options.rank : Infinity
    };

    let match = this.findMatch(item);
    if (match == null) {
      let command: { [option: string]: string } = {};
      command[item.category] = item.command;
      this._items.push({
        options: [item.category],
        commands: command,
        args: item.args,
        category: item.category,
        rank: item.rank,
        kernelIconUrl: item.kernelIconUrl,
        usageCount: this.getUsageCount(options)
      });
    } else {
      match.options.push(item.category);
      match.commands[item.category] = item.command;
    }
    this.stateChanged.emit(void 0);

    return new DisposableDelegate(() => {
      // ArrayExt.removeFirstOf(this._items, item);
      this.stateChanged.emit(void 0);
    });
  }

  fromJSON(data: JSONValue) {
    let dataObject = JSON.parse(data as string) as JSONObject;
    for (let key in dataObject) {
      let entry = dataObject[key] as JSONObject;
      this._usageData[key] = {
        usageCount: entry['usageCount'] as number,
        mostRecentUsage: entry['mostRecentUsage'] as string
      };
    }
  }

  getUsageCount(item: ILauncher.IItemOptions): number {
    let cwd = '';
    if (this._launcher) {
      cwd = this._launcher.cwd;
    }
    let kernelId =
      Private.getKernelName(item) + (cwd.length > 0 ? '-' + cwd : '');
    let count = 0;
    if (this._usageData[kernelId]) {
      count = this._usageData[kernelId].usageCount;
    }
    return count;
  }

  useCard(id: string) {
    if (id in this._usageData) {
      this._usageData[id] = {
        usageCount: this._usageData[id].usageCount + 1,
        mostRecentUsage: new Date().toString()
      };
    } else {
      this._usageData[id] = {
        usageCount: 1,
        mostRecentUsage: new Date().toString()
      };
    }
    let extensionId = '@jupyterlab/launcher-extension:plugin';
    let key = 'usage-data';
    this._settingRegistry
      .set(extensionId, key, JSON.stringify(this._usageData))
      .catch((reason: Error) => {
        console.error(
          `Failed to set ${extensionId}:${key} - ${reason.message}`
        );
      });
  }

  setSettingRegistey(settingsRegistry: ISettingRegistry) {
    this._settingRegistry = settingsRegistry;
  }

  /**
   * Check the item array, find if is there a grouped item only differs with
   * the given item option in command options and rank
   *
   * @param item - The item options to look for
   *
   * @returns Return the grouped item if found, otherwise return null
   */
  findMatch(item: ILauncher.IItemOptions): ILauncher.IGroupedItemOptions {
    for (let i = 0; i < this._items.length; i++) {
      let storedItem = this._items[i];
      if (
        item.args != null &&
        storedItem.args != null &&
        storedItem.kernelIconUrl === item.kernelIconUrl
      ) {
        let itemName = null;
        let storedItemName = null;
        if (item.args['kernelPreference'] != null) {
          itemName = (item.args['kernelPreference'] as ReadonlyJSONObject)[
            'name'
          ];
        } else {
          itemName = item.args['kernelName'];
        }
        if (storedItem.args['kernelPreference'] != null) {
          storedItemName = (storedItem.args[
            'kernelPreference'
          ] as ReadonlyJSONObject)['name'];
        } else {
          storedItemName = storedItem.args['kernelName'];
        }
        if (itemName === storedItemName) {
          return storedItem;
        }
      }
    }
    return null;
  }

  /**
   * Return an iterator of launcher items.
   */
  items(): IIterator<ILauncher.IGroupedItemOptions> {
    return new ArrayIterator(this._items);
  }

  set launcher(launcher: Launcher) {
    this._launcher = launcher;
  }

  sortedItemsByUsage() {
    return this._items.sort(
      (a: ILauncher.IGroupedItemOptions, b: ILauncher.IGroupedItemOptions) => {
        return b.usageCount - a.usageCount;
      }
    );
  }

  private _items: ILauncher.IGroupedItemOptions[] = [];
  private _usageData: { [name: string]: IUsageData } = {};
  private _settingRegistry: ISettingRegistry = null;
  private _launcher: Launcher = null;
}

/**
 * A virtual-DOM-based widget for the Launcher.
 */
export class Launcher extends VDomRenderer<LauncherModel> {
  /**
   * Construct a new launcher widget.
   */
  constructor(options: ILauncher.IOptions) {
    super();
    this._cwd = options.cwd;
    this._callback = options.callback;
    this._commands = options.commands;
    this.addClass(LAUNCHER_CLASS);
  }

  /**
   * The cwd of the launcher.
   */
  get cwd(): string {
    return this._cwd;
  }
  set cwd(value: string) {
    this._cwd = value;
    this.update();
  }

  /**
   * Whether there is a pending item being launched.
   */
  get pending(): boolean {
    return this._pending;
  }
  set pending(value: boolean) {
    this._pending = value;
  }

  /**
   * Render the launcher to virtual DOM nodes.
   */
  protected render(): React.ReactElement<any> {
    // Bail if there is no model.
    if (!this.model) {
      return null;
    }

    // First group-by categories
    let categories = Object.create(null);
    each(KNOWN_CATEGORIES, knownCat => {
      categories[knownCat] = [];
    });
    each(this.model.items(), (item, index) => {
      let cat = item.category || 'Other';
      if (cat == 'Other') {
        categories['Other'].push(item);
      } else {
        categories['Environment'].push(item);
      }
    });
    // Within each category sort by rank
    for (let cat in categories) {
      categories[cat] = categories[cat].sort(
        (
          a: ILauncher.IGroupedItemOptions,
          b: ILauncher.IGroupedItemOptions
        ) => {
          return Private.sortCmp(a, b, this._cwd, this._commands);
        }
      );
    }

    // Variable to help create sections
    let sections: React.ReactElement<any>[] = [];
    let section: React.ReactElement<any>;

    // Assemble the final ordered list of categories, beginning with
    // KNOWN_CATEGORIES.
    let orderedCategories: string[] = [];
    each(KNOWN_CATEGORIES, (cat, index) => {
      orderedCategories.push(cat);
    });
    for (let cat in categories) {
      if (KNOWN_CATEGORIES.indexOf(cat) === -1) {
        orderedCategories.push(cat);
      }
    }

    let tableCategories = Object.create(null);
    for (let cat in categories) {
      tableCategories[cat] = [...categories[cat]];
    }

    let orderedItems = this.model.sortedItemsByUsage();
    let i = 0;
    let topUsed: ILauncher.IGroupedItemOptions[] = [];
    while (i < 4) {
      if (orderedItems[i].category === 'Other') {
        continue;
      }
      topUsed.push(orderedItems[i]);
      i++;
    }

    // Render the most used items
    /* if (this._renderTable) { 
      section = (
        <div className="jp-Launcher-section" key="most-used">
          <div className="jp-Launcher-sectionHeader">
            <h2 className="jp-Launcher-sectionTitle">Most used</h2>
          </div>
          <div className="jp-Launcher-table">
            <div className="jp-Launcher-table-header jp-Launcher-table-row">
              <div>Launch</div>
              <div>Name</div>
              <div>Last Used</div>    
            </div>
            {toArray(
              map(topUsed.splice(0, 3), (item: ILauncher.IGroupedItemOptions) => {
                return Card(
                  false,
                  item,
                  this,
                  this._commands,
                  this._callback,
                  this._renderTable
                );
              })
            )}
          </div>
        </div>
      );
    } else {
      section = (
        <div className="jp-Launcher-section" key="most-used">
          <div className="jp-Launcher-sectionHeader">
            <h2 className="jp-Launcher-sectionTitle">Most used</h2>
          </div>
          <div className="jp-Launcher-cardContainer">
            {toArray(
              map(topUsed, (item: ILauncher.IGroupedItemOptions) => {
                return Card(
                  false,
                  item,
                  this,
                  this._commands,
                  this._callback,
                  this._renderTable
                );
              })
            )}
          </div>
        </div>
      );
    }
    sections.push(section); */

    // Now create the sections for each category
    orderedCategories.forEach(cat => {
      let kernel = cat == 'Environment';
      if (cat in tableCategories) {
        if (this._renderTable) {
          section = (
            <div className="jp-Launcher-section" key={cat}>
              <div className="jp-Launcher-sectionHeader">
                <h2 className="jp-Launcher-sectionTitle">{cat}</h2>
              </div>
              <div className="jp-Launcher-table">
                <div className="jp-Launcher-table-header jp-Launcher-table-row">
                  <div>Launch</div>
                  <div>Name</div>
                  <div>Last Used</div>
                </div>
                {toArray(
                  map(
                    categories[cat],
                    (item: ILauncher.IGroupedItemOptions) => {
                      return Card(
                        kernel,
                        item,
                        this,
                        this._commands,
                        this._callback,
                        this._renderTable
                      );
                    }
                  )
                )}
              </div>
            </div>
          );
        } else {
          section = (
            <div className="jp-Launcher-section" key={cat}>
              <div className="jp-Launcher-sectionHeader">
                <h2 className="jp-Launcher-sectionTitle">{cat}</h2>
              </div>
              <div className="jp-Launcher-cardContainer">
                {toArray(
                  map(
                    categories[cat],
                    (item: ILauncher.IGroupedItemOptions) => {
                      return Card(
                        kernel,
                        item,
                        this,
                        this._commands,
                        this._callback,
                        this._renderTable
                      );
                    }
                  )
                )}
              </div>
            </div>
          );
        }
        sections.push(section);
      }
    });

    // Wrap the sections in body and content divs.
    return (
      <div className="jp-Launcher-body">
        <div className="jp-Launcher-content">
          <div className="jp-Launcher-cwd">
            <h3>{this.cwd}</h3>
          </div>
          {sections}
        </div>
      </div>
    );
  }

  private _commands: CommandRegistry;
  private _callback: (widget: Widget) => void;
  private _pending = false;
  private _cwd = '';
  private _renderTable = false;
}

/**
 * The namespace for `ILauncher` class statics.
 */
export namespace ILauncher {
  /**
   * The options used to create a Launcher.
   */
  export interface IOptions {
    /**
     * The cwd of the launcher.
     */
    cwd: string;

    /**
     * The command registry used by the launcher.
     */
    commands: CommandRegistry;

    /**
     * The callback used when an item is launched.
     */
    callback: (widget: Widget) => void;
  }

  /**
   * The options used to create a launcher item.
   */
  export interface IItemOptions {
    /**
     * The command ID for the launcher item.
     *
     * #### Notes
     * If the command's `execute` method returns a `Widget` or
     * a promise that resolves with a `Widget`, then that widget will
     * replace the launcher in the same location of the application
     * shell. If the `execute` method does something else
     * (i.e., create a modal dialog), then the launcher will not be
     * disposed.
     */
    command: string;

    /**
     * The arguments given to the command for
     * creating the launcher item.
     *
     * ### Notes
     * The launcher will also add the current working
     * directory of the filebrowser in the `cwd` field
     * of the args, which a command may use to create
     * the activity with respect to the right directory.
     */
    args?: ReadonlyJSONObject;

    /**
     * The category for the launcher item.
     *
     * The default value is the an empty string.
     */
    category?: string;

    /**
     * The rank for the launcher item.
     *
     * The rank is used when ordering launcher items for display. After grouping
     * into categories, items are sorted in the following order:
     *   1. Rank (lower is better)
     *   3. Display Name (locale order)
     *
     * The default rank is `Infinity`.
     */
    rank?: number;

    /**
     * For items that have a kernel associated with them, the URL of the kernel
     * icon.
     *
     * This is not a CSS class, but the URL that points to the icon in the kernel
     * spec.
     */
    kernelIconUrl?: string;
  }

  export interface IGroupedItemOptions {
    /**
     * Possible command options for this item
     */
    options: [string];

    /**
     * The command ID for the launcher item.
     *
     * #### Notes
     * If the command's `execute` method returns a `Widget` or
     * a promise that resolves with a `Widget`, then that widget will
     * replace the launcher in the same location of the application
     * shell. If the `execute` method does something else
     * (i.e., create a modal dialog), then the launcher will not be
     * disposed.
     */
    commands: { [option: string]: string };

    /**
     * The arguments given to the command for
     * creating the launcher item.
     *
     * ### Notes
     * The launcher will also add the current working
     * directory of the filebrowser in the `cwd` field
     * of the args, which a command may use to create
     * the activity with respect to the right directory.
     */
    args?: ReadonlyJSONObject;

    /**
     * The category for the launcher item.
     *
     * The default value is the an empty string.
     */
    category?: string;

    /**
     * The rank for the launcher item.
     *
     * The rank is used when ordering launcher items for display. After grouping
     * into categories, items are sorted in the following order:
     *   1. Rank (lower is better)
     *   3. Display Name (locale order)
     *
     * The default rank is `Infinity`.
     */
    rank?: number;

    /**
     * Used for determining the most used item in launcher.
     *
     * Based on the usage count of the items.
     */
    usageCount?: number;

    /**
     * For items that have a kernel associated with them, the URL of the kernel
     * icon.
     *
     * This is not a CSS class, but the URL that points to the icon in the kernel
     * spec.
     */
    kernelIconUrl?: string;
  }
}

/**
 * A pure tsx component for a launcher card.
 *
 * @param kernel - whether the item takes uses a kernel.
 *
 * @param item - the launcher item to render.
 *
 * @param launcher - the Launcher instance to which this is added.
 *
 * @param launcherCallback - a callback to call after an item has been launched.
 *
 * @returns a vdom `VirtualElement` for the launcher card.
 */
function Card(
  kernel: boolean,
  item: ILauncher.IGroupedItemOptions,
  launcher: Launcher,
  commands: CommandRegistry,
  launcherCallback: (widget: Widget) => void,
  renderRow: boolean
): React.ReactElement<any> {
  // Get some properties of the command
  const command = item.commands[item.options[0]];
  const args = { ...item.args, cwd: launcher.cwd };
  const label = commands.label(command, args);

  // Build the onclick handler.
  let onclickFactory = (currentCommand: string) => {
    let onclick = () => {
      // If an item has already been launched,
      // don't try to launch another.
      if (launcher.pending === true) {
        return;
      }
      launcher.pending = true;
      commands
        .execute(currentCommand, {
          ...item.args,
          cwd: launcher.cwd
        })
        .then(value => {
          launcher.pending = false;
          if (value instanceof Widget) {
            launcherCallback(value);
            launcher.dispose();
          }
        })
        .catch(err => {
          launcher.pending = false;
          showErrorMessage('Launcher Error', err);
        });
    };
    return onclick;
  };

  let getOptions = () => {
    let options: JSX.Element[] = [];
    each(item.options, option => {
      options.push(
        <div
          className="jp-Launcher-option-button"
          onClick={onclickFactory(item.commands[option])}
        >
          {(option === 'Other' ? 'Open' : option).toUpperCase()}
        </div>
      );
    });
    return options;
  };

  // Return the VDOM element.
  if (renderRow) {
    return (
      <div className="jp-Launcher-table-row">
        <div>{getOptions()}</div>
        <div>{label}</div>
        <div>{launcher.cwd}</div>
      </div>
    );
  }
  return (
    <div
      className="jp-LauncherCard"
      title={label}
      data-category={item.category || 'Other'}
      key={Private.keyProperty.get(item)}
    >
      <div className="jp-LauncherCard-icon">
        {item.kernelIconUrl &&
          kernel && (
            <img src={item.kernelIconUrl} className="jp-Launcher-kernelIcon" />
          )}
        {!item.kernelIconUrl &&
          !kernel && (
            <div
              className={`${commands.iconClass(
                command,
                args
              )} jp-Launcher-icon`}
            />
          )}
        {!item.kernelIconUrl &&
          kernel && (
            <div className="jp-LauncherCard-noKernelIcon">
              {label[0].toUpperCase()}
            </div>
          )}
      </div>
      <div className="jp-LauncherCard-label" title={label}>
        {label}
      </div>
      <div className="jp-LauncherCard-options">{getOptions()}</div>
    </div>
  );
}

/**
 * The namespace for module private data.
 */
namespace Private {
  /**
   * An incrementing counter for keys.
   */
  let id = 0;

  /**
   * An attached property for an item's key.
   */
  export const keyProperty = new AttachedProperty<
    ILauncher.IGroupedItemOptions,
    number
  >({
    name: 'key',
    create: () => id++
  });

  export function getKernelName(item: ILauncher.IItemOptions): string {
    if (item.args) {
      if (item.args['kernelName']) {
        return item.args['kernelName'].toString();
      } else {
        if (item.args['kernelPreference']) {
          if ((item.args['kernelPreference'] as JSONObject)['name']) {
            return (item.args['kernelPreference'] as JSONObject)[
              'name'
            ].toString();
          }
        }
      }
    } else {
      return item.command;
    }
  }

  /**
   * A sort comparison function for a launcher item.
   */
  export function sortCmp(
    a: ILauncher.IGroupedItemOptions,
    b: ILauncher.IGroupedItemOptions,
    cwd: string,
    commands: CommandRegistry
  ): number {
    // First, compare by rank.
    let r1 = a.rank;
    let r2 = b.rank;
    if (r1 !== r2 && r1 !== undefined && r2 !== undefined) {
      return r1 < r2 ? -1 : 1; // Infinity safe
    }

    // Finally, compare by display name.
    const aLabel = commands.label(a.commands[a.options[0]], { ...a.args, cwd });
    const bLabel = commands.label(a.commands[a.options[0]], { ...b.args, cwd });
    return aLabel.localeCompare(bLabel);
  }
}
