// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { each, find } from '@phosphor/algorithm';

import { IDisposable } from '@phosphor/disposable';

import { Menu, Widget } from '@phosphor/widgets';

import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, showDialog, Dialog } from '@jupyterlab/apputils';

import { PageConfig, URLExt } from '@jupyterlab/coreutils';

import { IInspector } from '@jupyterlab/inspector';

import {
  IMainMenu,
  IMenuExtender,
  EditMenu,
  FileMenu,
  KernelMenu,
  MainMenu,
  RunMenu,
  SettingsMenu,
  ViewMenu,
  TabsMenu
} from '@jupyterlab/mainmenu';

import { ServerConnection } from '@jupyterlab/services';

/**
 * A namespace for command IDs of semantic extension points.
 */
export namespace CommandIDs {
  export const openEdit = 'editmenu:open';

  export const undo = 'editmenu:undo';

  export const redo = 'editmenu:redo';

  export const clearCurrent = 'editmenu:clear-current';

  export const clearAll = 'editmenu:clear-all';

  export const find = 'editmenu:find';

  export const findAndReplace = 'editmenu:find-and-replace';

  export const goToLine = 'editmenu:go-to-line';

  export const openFile = 'filemenu:open';

  export const closeAndCleanup = 'filemenu:close-and-cleanup';

  export const persistAndSave = 'filemenu:persist-and-save';

  export const createConsole = 'filemenu:create-console';

  export const quit = 'filemenu:quit';

  export const openKernel = 'kernelmenu:open';

  export const interruptKernel = 'kernelmenu:interrupt';

  export const restartKernel = 'kernelmenu:restart';

  export const restartKernelAndClear = 'kernelmenu:restart-and-clear';

  export const changeKernel = 'kernelmenu:change';

  export const shutdownKernel = 'kernelmenu:shutdown';

  export const shutdownAllKernels = 'kernelmenu:shutdownAll';

  export const openView = 'viewmenu:open';

  export const wordWrap = 'viewmenu:word-wrap';

  export const lineNumbering = 'viewmenu:line-numbering';

  export const matchBrackets = 'viewmenu:match-brackets';

  export const openRun = 'runmenu:open';

  export const run = 'runmenu:run';

  export const runAll = 'runmenu:run-all';

  export const restartAndRunAll = 'runmenu:restart-and-run-all';

  export const runAbove = 'runmenu:run-above';

  export const runBelow = 'runmenu:run-below';

  export const openTabs = 'tabsmenu:open';

  export const activateById = 'tabsmenu:activate-by-id';

  export const activatePreviouslyUsedTab =
    'tabsmenu:activate-previously-used-tab';

  export const openSettings = 'settingsmenu:open';

  export const openHelp = 'helpmenu:open';

  export const openFirst = 'mainmenu:open-first';
}

/**
 * A service providing an interface to the main menu.
 */
const plugin: JupyterFrontEndPlugin<IMainMenu> = {
  id: '@jupyterlab/mainmenu-extension:plugin',
  requires: [ICommandPalette],
  optional: [IInspector, ILabShell],
  provides: IMainMenu,
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    inspector: IInspector | null,
    labShell: ILabShell | null
  ): IMainMenu => {
    const { commands } = app;

    let menu = new MainMenu(commands);
    menu.id = 'jp-MainMenu';

    let logo = new Widget();
    logo.addClass('jp-MainAreaPortraitIcon');
    logo.addClass('jp-JupyterIcon');
    logo.id = 'jp-MainLogo';

    // Only add quit button if the back-end supports it by checking page config.
    let quitButton = PageConfig.getOption('quitButton');
    menu.fileMenu.quitEntry = quitButton === 'True';

    // Create the application menus.
    createEditMenu(app, menu.editMenu);
    createFileMenu(app, menu.fileMenu, inspector);
    createKernelMenu(app, menu.kernelMenu);
    createRunMenu(app, menu.runMenu);
    createSettingsMenu(app, menu.settingsMenu);
    createViewMenu(app, menu.viewMenu);

    // The tabs menu relies on lab shell functionality.
    if (labShell) {
      createTabsMenu(app, menu.tabsMenu, labShell);
    }

    // Create commands to open the main application menus.
    const activateMenu = (item: Menu) => {
      menu.activeMenu = item;
      menu.openActiveMenu();
    };

    commands.addCommand(CommandIDs.openEdit, {
      label: 'Open Edit Menu',
      execute: () => activateMenu(menu.editMenu.menu)
    });
    commands.addCommand(CommandIDs.openFile, {
      label: 'Open File Menu',
      execute: () => activateMenu(menu.fileMenu.menu)
    });
    commands.addCommand(CommandIDs.openKernel, {
      label: 'Open Kernel Menu',
      execute: () => activateMenu(menu.kernelMenu.menu)
    });
    commands.addCommand(CommandIDs.openRun, {
      label: 'Open Run Menu',
      execute: () => activateMenu(menu.runMenu.menu)
    });
    commands.addCommand(CommandIDs.openView, {
      label: 'Open View Menu',
      execute: () => activateMenu(menu.viewMenu.menu)
    });
    commands.addCommand(CommandIDs.openSettings, {
      label: 'Open Settings Menu',
      execute: () => activateMenu(menu.settingsMenu.menu)
    });
    commands.addCommand(CommandIDs.openTabs, {
      label: 'Open Tabs Menu',
      execute: () => activateMenu(menu.tabsMenu.menu)
    });
    commands.addCommand(CommandIDs.openHelp, {
      label: 'Open Help Menu',
      execute: () => activateMenu(menu.helpMenu.menu)
    });
    commands.addCommand(CommandIDs.openFirst, {
      label: 'Open First Menu',
      execute: () => {
        menu.activeIndex = 0;
        menu.openActiveMenu();
      }
    });

    // Add some of the commands defined here to the command palette.
    if (menu.fileMenu.quitEntry) {
      palette.addItem({
        command: CommandIDs.quit,
        category: 'Main Area'
      });
    }

    palette.addItem({
      command: CommandIDs.shutdownAllKernels,
      category: 'Kernel Operations'
    });

    palette.addItem({
      command: CommandIDs.activatePreviouslyUsedTab,
      category: 'Main Area'
    });

    app.shell.add(logo, 'top');
    app.shell.add(menu, 'top');

    return menu;
  }
};

/**
 * Create the basic `Edit` menu.
 */
export function createEditMenu(app: JupyterFrontEnd, menu: EditMenu): void {
  const commands = menu.menu.commands;

  // Add the undo/redo commands the the Edit menu.
  commands.addCommand(CommandIDs.undo, {
    label: 'Undo',
    isEnabled: Private.delegateEnabled(app, menu.undoers, 'undo'),
    execute: Private.delegateExecute(app, menu.undoers, 'undo')
  });
  commands.addCommand(CommandIDs.redo, {
    label: 'Redo',
    isEnabled: Private.delegateEnabled(app, menu.undoers, 'redo'),
    execute: Private.delegateExecute(app, menu.undoers, 'redo')
  });
  menu.addGroup(
    [{ command: CommandIDs.undo }, { command: CommandIDs.redo }],
    0
  );

  // Add the clear commands to the Edit menu.
  commands.addCommand(CommandIDs.clearCurrent, {
    label: () => {
      const noun = Private.delegateLabel(app, menu.clearers, 'noun');
      const enabled = Private.delegateEnabled(
        app,
        menu.clearers,
        'clearCurrent'
      )();
      return `Clear${enabled ? ` ${noun}` : ''}`;
    },
    isEnabled: Private.delegateEnabled(app, menu.clearers, 'clearCurrent'),
    execute: Private.delegateExecute(app, menu.clearers, 'clearCurrent')
  });
  commands.addCommand(CommandIDs.clearAll, {
    label: () => {
      const noun = Private.delegateLabel(app, menu.clearers, 'pluralNoun');
      const enabled = Private.delegateEnabled(app, menu.clearers, 'clearAll')();
      return `Clear All${enabled ? ` ${noun}` : ''}`;
    },
    isEnabled: Private.delegateEnabled(app, menu.clearers, 'clearAll'),
    execute: Private.delegateExecute(app, menu.clearers, 'clearAll')
  });
  menu.addGroup(
    [{ command: CommandIDs.clearCurrent }, { command: CommandIDs.clearAll }],
    10
  );

  // Add the find-replace command to the Edit menu.
  commands.addCommand(CommandIDs.findAndReplace, {
    label: 'Find and Replace…',
    isEnabled: Private.delegateEnabled(
      app,
      menu.findReplacers,
      'findAndReplace'
    ),
    execute: Private.delegateExecute(app, menu.findReplacers, 'findAndReplace')
  });
  menu.addGroup(
    [{ command: CommandIDs.find }, { command: CommandIDs.findAndReplace }],
    200
  );
  commands.addCommand(CommandIDs.goToLine, {
    label: 'Go to Line…',
    isEnabled: Private.delegateEnabled(app, menu.goToLiners, 'goToLine'),
    execute: Private.delegateExecute(app, menu.goToLiners, 'goToLine')
  });
  menu.addGroup([{ command: CommandIDs.goToLine }], 200);
}

/**
 * Create the basic `File` menu.
 */
export function createFileMenu(
  app: JupyterFrontEnd,
  menu: FileMenu,
  inspector: IInspector | null
): void {
  const commands = menu.menu.commands;

  // Add a delegator command for closing and cleaning up an activity.
  commands.addCommand(CommandIDs.closeAndCleanup, {
    label: () => {
      const action = Private.delegateLabel(
        app,
        menu.closeAndCleaners,
        'action'
      );
      const name = Private.delegateLabel(app, menu.closeAndCleaners, 'name');
      return `Close and ${action ? ` ${action} ${name}` : 'Shutdown'}`;
    },
    isEnabled: Private.delegateEnabled(
      app,
      menu.closeAndCleaners,
      'closeAndCleanup'
    ),
    execute: Private.delegateExecute(
      app,
      menu.closeAndCleaners,
      'closeAndCleanup'
    )
  });

  // Add a delegator command for persisting data then saving.
  commands.addCommand(CommandIDs.persistAndSave, {
    label: () => {
      const action = Private.delegateLabel(
        app,
        menu.persistAndSavers,
        'action'
      );
      const name = Private.delegateLabel(app, menu.persistAndSavers, 'name');
      return `Save ${name} ${action || 'with Extras'}`;
    },
    isEnabled: args => {
      return (
        Private.delegateEnabled(
          app,
          menu.persistAndSavers,
          'persistAndSave'
        )() && commands.isEnabled('docmanager:save', args)
      );
    },
    execute: Private.delegateExecute(
      app,
      menu.persistAndSavers,
      'persistAndSave'
    )
  });

  // Add a delegator command for creating a console for an activity.
  commands.addCommand(CommandIDs.createConsole, {
    label: () => {
      const name = Private.delegateLabel(app, menu.consoleCreators, 'name');
      const label = `New Console for ${name ? name : 'Activity'}`;
      return label;
    },
    isEnabled: Private.delegateEnabled(
      app,
      menu.consoleCreators,
      'createConsole'
    ),
    execute: Private.delegateExecute(app, menu.consoleCreators, 'createConsole')
  });

  commands.addCommand(CommandIDs.quit, {
    label: 'Quit',
    caption: 'Quit JupyterLab',
    execute: () => {
      showDialog({
        title: 'Quit confirmation',
        body: 'Please confirm you want to quit JupyterLab.',
        buttons: [Dialog.cancelButton(), Dialog.warnButton({ label: 'Quit' })]
      }).then(result => {
        if (result.button.accept) {
          let setting = ServerConnection.makeSettings();
          let apiURL = URLExt.join(setting.baseUrl, 'api/shutdown');
          ServerConnection.makeRequest(apiURL, { method: 'POST' }, setting)
            .then(result => {
              if (result.ok) {
                // Close this window if the shutdown request has been successful
                let body = document.createElement('div');
                body.innerHTML = `<p>You have shut down the Jupyter server. You can now close this tab.</p>
                  <p>To use JupyterLab again, you will need to relaunch it.</p>`;
                showDialog({
                  title: 'Server stopped',
                  body: new Widget({ node: body }),
                  buttons: []
                });
                window.close();
              } else {
                throw new ServerConnection.ResponseError(result);
              }
            })
            .catch(data => {
              throw new ServerConnection.NetworkError(data);
            });
        }
      });
    }
  });

  // Add the new group
  const newGroup = [
    { type: 'submenu' as Menu.ItemType, submenu: menu.newMenu.menu },
    { command: 'filebrowser:create-main-launcher' }
  ];

  const newViewGroup = [
    { command: 'docmanager:clone' },
    { command: CommandIDs.createConsole },
    inspector ? { command: 'inspector:open' } : null,
    { command: 'docmanager:open-direct' }
  ].filter(item => !!item);

  // Add the close group
  const closeGroup = [
    'docmanager:close',
    'filemenu:close-and-cleanup',
    'docmanager:close-all-files'
  ].map(command => {
    return { command };
  });

  // Add save group.
  const saveGroup = [
    'docmanager:save',
    'filemenu:persist-and-save',
    'docmanager:save-as',
    'docmanager:save-all'
  ].map(command => {
    return { command };
  });

  // Add the re group.
  const reGroup = [
    'docmanager:reload',
    'docmanager:restore-checkpoint',
    'docmanager:rename'
  ].map(command => {
    return { command };
  });

  // Add the quit group.
  const quitGroup = [{ command: 'filemenu:quit' }];

  menu.addGroup(newGroup, 0);
  menu.addGroup(newViewGroup, 1);
  menu.addGroup(closeGroup, 2);
  menu.addGroup(saveGroup, 3);
  menu.addGroup(reGroup, 4);
  if (menu.quitEntry) {
    menu.addGroup(quitGroup, 99);
  }
}

/**
 * Create the basic `Kernel` menu.
 */
export function createKernelMenu(app: JupyterFrontEnd, menu: KernelMenu): void {
  const commands = menu.menu.commands;

  commands.addCommand(CommandIDs.interruptKernel, {
    label: 'Interrupt Kernel',
    isEnabled: Private.delegateEnabled(
      app,
      menu.kernelUsers,
      'interruptKernel'
    ),
    execute: Private.delegateExecute(app, menu.kernelUsers, 'interruptKernel')
  });

  commands.addCommand(CommandIDs.restartKernel, {
    label: 'Restart Kernel…',
    isEnabled: Private.delegateEnabled(app, menu.kernelUsers, 'restartKernel'),
    execute: Private.delegateExecute(app, menu.kernelUsers, 'restartKernel')
  });

  commands.addCommand(CommandIDs.restartKernelAndClear, {
    label: () => {
      const noun = Private.delegateLabel(app, menu.kernelUsers, 'noun');
      const enabled = Private.delegateEnabled(
        app,
        menu.kernelUsers,
        'restartKernelAndClear'
      )();
      return `Restart Kernel and Clear${enabled ? ` ${noun}` : ''}…`;
    },
    isEnabled: Private.delegateEnabled(
      app,
      menu.kernelUsers,
      'restartKernelAndClear'
    ),
    execute: Private.delegateExecute(
      app,
      menu.kernelUsers,
      'restartKernelAndClear'
    )
  });

  commands.addCommand(CommandIDs.changeKernel, {
    label: 'Change Kernel…',
    isEnabled: Private.delegateEnabled(app, menu.kernelUsers, 'changeKernel'),
    execute: Private.delegateExecute(app, menu.kernelUsers, 'changeKernel')
  });

  commands.addCommand(CommandIDs.shutdownKernel, {
    label: 'Shutdown Kernel',
    isEnabled: Private.delegateEnabled(app, menu.kernelUsers, 'shutdownKernel'),
    execute: Private.delegateExecute(app, menu.kernelUsers, 'shutdownKernel')
  });

  commands.addCommand(CommandIDs.shutdownAllKernels, {
    label: 'Shutdown All Kernels…',
    isEnabled: () => {
      return app.serviceManager.sessions.running().next() !== undefined;
    },
    execute: () => {
      showDialog({
        title: 'Shutdown All?',
        body: 'Shut down all kernels?',
        buttons: [
          Dialog.cancelButton(),
          Dialog.warnButton({ label: 'SHUTDOWN' })
        ]
      }).then(result => {
        if (result.button.accept) {
          return app.serviceManager.sessions.shutdownAll();
        }
      });
    }
  });

  const restartGroup = [
    CommandIDs.restartKernel,
    CommandIDs.restartKernelAndClear,
    CommandIDs.restartAndRunAll
  ].map(command => {
    return { command };
  });

  menu.addGroup([{ command: CommandIDs.interruptKernel }], 0);
  menu.addGroup(restartGroup, 1);
  menu.addGroup(
    [
      { command: CommandIDs.shutdownKernel },
      { command: CommandIDs.shutdownAllKernels }
    ],
    2
  );
  menu.addGroup([{ command: CommandIDs.changeKernel }], 3);
}

/**
 * Create the basic `View` menu.
 */
export function createViewMenu(app: JupyterFrontEnd, menu: ViewMenu): void {
  const commands = menu.menu.commands;

  commands.addCommand(CommandIDs.lineNumbering, {
    label: 'Show Line Numbers',
    isEnabled: Private.delegateEnabled(
      app,
      menu.editorViewers,
      'toggleLineNumbers'
    ),
    isToggled: Private.delegateToggled(
      app,
      menu.editorViewers,
      'lineNumbersToggled'
    ),
    execute: Private.delegateExecute(
      app,
      menu.editorViewers,
      'toggleLineNumbers'
    )
  });

  commands.addCommand(CommandIDs.matchBrackets, {
    label: 'Match Brackets',
    isEnabled: Private.delegateEnabled(
      app,
      menu.editorViewers,
      'toggleMatchBrackets'
    ),
    isToggled: Private.delegateToggled(
      app,
      menu.editorViewers,
      'matchBracketsToggled'
    ),
    execute: Private.delegateExecute(
      app,
      menu.editorViewers,
      'toggleMatchBrackets'
    )
  });

  commands.addCommand(CommandIDs.wordWrap, {
    label: 'Wrap Words',
    isEnabled: Private.delegateEnabled(
      app,
      menu.editorViewers,
      'toggleWordWrap'
    ),
    isToggled: Private.delegateToggled(
      app,
      menu.editorViewers,
      'wordWrapToggled'
    ),
    execute: Private.delegateExecute(app, menu.editorViewers, 'toggleWordWrap')
  });

  menu.addGroup(
    [
      { command: 'application:toggle-left-area' },
      { command: 'application:toggle-right-area' }
    ],
    0
  );

  const editorViewerGroup = [
    CommandIDs.lineNumbering,
    CommandIDs.matchBrackets,
    CommandIDs.wordWrap
  ].map(command => {
    return { command };
  });
  menu.addGroup(editorViewerGroup, 10);

  // Add the command for toggling single-document mode.
  menu.addGroup(
    [
      { command: 'application:toggle-presentation-mode' },
      { command: 'application:toggle-mode' }
    ],
    1000
  );
}

/**
 * Create the basic `Run` menu.
 */
export function createRunMenu(app: JupyterFrontEnd, menu: RunMenu): void {
  const commands = menu.menu.commands;

  commands.addCommand(CommandIDs.run, {
    label: () => {
      const noun = Private.delegateLabel(app, menu.codeRunners, 'noun');
      const enabled = Private.delegateEnabled(app, menu.codeRunners, 'run')();
      return `Run Selected${enabled ? ` ${noun}` : ''}`;
    },
    isEnabled: Private.delegateEnabled(app, menu.codeRunners, 'run'),
    execute: Private.delegateExecute(app, menu.codeRunners, 'run')
  });

  commands.addCommand(CommandIDs.runAll, {
    label: () => {
      const noun = Private.delegateLabel(app, menu.codeRunners, 'noun');
      const enabled = Private.delegateEnabled(
        app,
        menu.codeRunners,
        'runAll'
      )();
      return `Run All${enabled ? ` ${noun}` : ''}`;
    },
    isEnabled: Private.delegateEnabled(app, menu.codeRunners, 'runAll'),
    execute: Private.delegateExecute(app, menu.codeRunners, 'runAll')
  });

  commands.addCommand(CommandIDs.restartAndRunAll, {
    label: () => {
      const noun = Private.delegateLabel(app, menu.codeRunners, 'noun');
      const enabled = Private.delegateEnabled(
        app,
        menu.codeRunners,
        'restartAndRunAll'
      )();
      return `Restart Kernel and Run All${enabled ? ` ${noun}` : ''}…`;
    },
    isEnabled: Private.delegateEnabled(
      app,
      menu.codeRunners,
      'restartAndRunAll'
    ),
    execute: Private.delegateExecute(app, menu.codeRunners, 'restartAndRunAll')
  });

  const runAllGroup = [CommandIDs.runAll, CommandIDs.restartAndRunAll].map(
    command => {
      return { command };
    }
  );

  menu.addGroup([{ command: CommandIDs.run }], 0);
  menu.addGroup(runAllGroup, 999);
}

/**
 * Create the basic `Settings` menu.
 */
export function createSettingsMenu(
  _: JupyterFrontEnd,
  menu: SettingsMenu
): void {
  menu.addGroup([{ command: 'settingeditor:open' }], 1000);
}

/**
 * Create the basic `Tabs` menu.
 */
export function createTabsMenu(
  app: JupyterFrontEnd,
  menu: TabsMenu,
  labShell: ILabShell | null
): void {
  const commands = app.commands;

  // Add commands for cycling the active tabs.
  menu.addGroup(
    [
      { command: 'application:activate-next-tab' },
      { command: 'application:activate-previous-tab' },
      { command: CommandIDs.activatePreviouslyUsedTab }
    ],
    0
  );

  // A list of the active tabs in the main area.
  const tabGroup: Menu.IItemOptions[] = [];
  // A disposable for getting rid of the out-of-date tabs list.
  let disposable: IDisposable;

  // Command to activate a widget by id.
  commands.addCommand(CommandIDs.activateById, {
    label: args => {
      const id = args['id'] || '';
      const widget = find(app.shell.widgets('main'), w => w.id === id);
      return (widget && widget.title.label) || '';
    },
    isToggled: args => {
      const id = args['id'] || '';
      return app.shell.currentWidget && app.shell.currentWidget.id === id;
    },
    execute: args => app.shell.activateById((args['id'] as string) || '')
  });

  let previousId = '';
  // Command to toggle between the current
  // tab and the last modified tab.
  commands.addCommand(CommandIDs.activatePreviouslyUsedTab, {
    label: 'Activate Previously Used Tab',
    isEnabled: () => !!previousId,
    execute: () => commands.execute(CommandIDs.activateById, { id: previousId })
  });

  if (labShell) {
    app.restored.then(() => {
      // Iterate over the current widgets in the
      // main area, and add them to the tab group
      // of the menu.
      const populateTabs = () => {
        // remove the previous tab list
        if (disposable && !disposable.isDisposed) {
          disposable.dispose();
        }
        tabGroup.length = 0;

        let isPreviouslyUsedTabAttached = false;
        each(app.shell.widgets('main'), widget => {
          if (widget.id === previousId) {
            isPreviouslyUsedTabAttached = true;
          }
          tabGroup.push({
            command: CommandIDs.activateById,
            args: { id: widget.id }
          });
        });
        disposable = menu.addGroup(tabGroup, 1);
        previousId = isPreviouslyUsedTabAttached ? previousId : '';
      };
      populateTabs();
      labShell.layoutModified.connect(() => {
        populateTabs();
      });
      // Update the ID of the previous active tab if a new tab is selected.
      labShell.currentChanged.connect((_, args) => {
        let widget = args.oldValue;
        if (!widget) {
          return;
        }
        previousId = widget.id;
      });
    });
  }
}

export default plugin;

/**
 * A namespace for Private data.
 */
namespace Private {
  /**
   * Return the first value of the iterable that satisfies the predicate
   * function.
   */
  function find<T>(
    it: Iterable<T>,
    predicate: (value: T) => boolean
  ): T | undefined {
    for (let value of it) {
      if (predicate(value)) {
        return value;
      }
    }
    return undefined;
  }

  /**
   * A utility function that delegates a portion of a label to an IMenuExtender.
   */
  export function delegateLabel<E extends IMenuExtender<Widget>>(
    app: JupyterFrontEnd,
    s: Set<E>,
    label: keyof E
  ): string {
    let widget = app.shell.currentWidget;
    const extender = find(s, value => value.tracker.has(widget));
    if (!extender) {
      return '';
    }
    // Coerce the result to be a string. When Typedoc is updated to use
    // Typescript 2.8, we can possibly use conditional types to get Typescript
    // to recognize this is a string.
    return (extender[label] as any) as string;
  }

  /**
   * A utility function that delegates command execution
   * to an IMenuExtender.
   */
  export function delegateExecute<E extends IMenuExtender<Widget>>(
    app: JupyterFrontEnd,
    s: Set<E>,
    executor: keyof E
  ): () => Promise<any> {
    return () => {
      let widget = app.shell.currentWidget;
      const extender = find(s, value => value.tracker.has(widget));
      if (!extender) {
        return Promise.resolve(void 0);
      }
      // Coerce the result to be a function. When Typedoc is updated to use
      // Typescript 2.8, we can possibly use conditional types to get Typescript
      // to recognize this is a function.
      let f = (extender[executor] as any) as (w: Widget) => Promise<any>;
      return f(widget);
    };
  }

  /**
   * A utility function that delegates whether a command is enabled
   * to an IMenuExtender.
   */
  export function delegateEnabled<E extends IMenuExtender<Widget>>(
    app: JupyterFrontEnd,
    s: Set<E>,
    executor: keyof E
  ): () => boolean {
    return () => {
      let widget = app.shell.currentWidget;
      const extender = find(s, value => value.tracker.has(widget));
      return (
        !!extender &&
        !!extender[executor] &&
        (extender.isEnabled ? extender.isEnabled(widget) : true)
      );
    };
  }

  /**
   * A utility function that delegates whether a command is toggled
   * for an IMenuExtender.
   */
  export function delegateToggled<E extends IMenuExtender<Widget>>(
    app: JupyterFrontEnd,
    s: Set<E>,
    toggled: keyof E
  ): () => boolean {
    return () => {
      let widget = app.shell.currentWidget;
      const extender = find(s, value => value.tracker.has(widget));
      // Coerce extender[toggled] to be a function. When Typedoc is updated to use
      // Typescript 2.8, we can possibly use conditional types to get Typescript
      // to recognize this is a function.
      return (
        !!extender &&
        !!extender[toggled] &&
        !!((extender[toggled] as any) as (w: Widget) => (() => boolean))(widget)
      );
    };
  }
}
