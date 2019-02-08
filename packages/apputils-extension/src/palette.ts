/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import { find } from '@phosphor/algorithm';

import { CommandRegistry } from '@phosphor/commands';
import { DisposableDelegate, IDisposable } from '@phosphor/disposable';

import { CommandPalette } from '@phosphor/widgets';

import { ILayoutRestorer, JupyterFrontEnd } from '@jupyterlab/application';

import { ICommandPalette, IPaletteItem } from '@jupyterlab/apputils';

/**
 * The command IDs used by the apputils extension.
 */
namespace CommandIDs {
  export const activate = 'apputils:activate-command-palette';
}

/**
 * A thin wrapper around the `CommandPalette` class to conform with the
 * JupyterLab interface for the application-wide command palette.
 */
export class Palette implements ICommandPalette {
  /**
   * Create a palette instance.
   */
  constructor(palette: CommandPalette) {
    this._palette = palette;
    this._palette.title.iconClass = 'jp-PaletteIcon jp-SideBar-tabIcon';
    this._palette.title.label = '';
    this._palette.title.caption = 'Command Palette';
  }

  /**
   * The placeholder text of the command palette's search input.
   */
  set placeholder(placeholder: string) {
    this._palette.inputNode.placeholder = placeholder;
  }
  get placeholder(): string {
    return this._palette.inputNode.placeholder;
  }

  /**
   * Activate the command palette for user input.
   */
  activate(): void {
    this._palette.activate();
  }

  /**
   * Add a command item to the command palette.
   *
   * @param options - The options for creating the command item.
   *
   * @returns A disposable that will remove the item from the palette.
   */
  addItem(options: IPaletteItem): IDisposable {
    let item = this._palette.addItem(options as CommandPalette.IItemOptions);
    return new DisposableDelegate(() => {
      this._palette.removeItem(item);
    });
  }

  private _palette: CommandPalette;
}

/**
 * A namespace for `Palette` statics.
 */
export namespace Palette {
  /**
   * Activate the command palette.
   */
  export function activate(app: JupyterFrontEnd): ICommandPalette {
    const { commands, shell } = app;
    const palette = Private.createPalette(app);

    // Show the current palette shortcut in its title.
    const updatePaletteTitle = () => {
      const binding = find(
        app.commands.keyBindings,
        b => b.command === CommandIDs.activate
      );
      if (binding) {
        const ks = CommandRegistry.formatKeystroke(binding.keys.join(' '));
        palette.title.caption = `Commands (${ks})`;
      } else {
        palette.title.caption = 'Commands';
      }
    };
    updatePaletteTitle();
    app.commands.keyBindingChanged.connect(() => {
      updatePaletteTitle();
    });

    commands.addCommand(CommandIDs.activate, {
      execute: () => {
        shell.activateById(palette.id);
      },
      label: 'Activate Command Palette'
    });

    palette.inputNode.placeholder = 'SEARCH';

    shell.add(palette, 'left', { rank: 300 });

    return new Palette(palette);
  }

  /**
   * Restore the command palette.
   */
  export function restore(
    app: JupyterFrontEnd,
    restorer: ILayoutRestorer
  ): void {
    const palette = Private.createPalette(app);

    // Let the application restorer track the command palette for restoration of
    // application state (e.g. setting the command palette as the current side bar
    // widget).
    restorer.add(palette, 'command-palette');
  }
}

/**
 * The namespace for module private data.
 */
namespace Private {
  /**
   * The private command palette instance.
   */
  let palette: CommandPalette;

  /**
   * Create the application-wide command palette.
   */
  export function createPalette(app: JupyterFrontEnd): CommandPalette {
    if (!palette) {
      palette = new CommandPalette({ commands: app.commands });
      palette.id = 'command-palette';
      palette.title.label = 'Commands';
    }

    return palette;
  }
}
