// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';

import {
  CodeConsole,
  ConsolePanel,
  IConsoleTracker,
  ForeignHandler
} from '@jupyterlab/console';

import { AttachedProperty } from '@phosphor/properties';

import { ReadonlyJSONObject } from '@phosphor/coreutils';

/**
 * The console widget tracker provider.
 */
export const foreign: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/console-extension:foreign',
  requires: [IConsoleTracker],
  optional: [ICommandPalette],
  activate: activateForeign,
  autoStart: true
};

export default foreign;

function activateForeign(
  app: JupyterFrontEnd,
  tracker: IConsoleTracker,
  palette: ICommandPalette | null
) {
  const { shell } = app;
  tracker.widgetAdded.connect((sender, panel) => {
    const console = panel.console;

    const handler = new ForeignHandler({
      session: console.session,
      parent: console
    });
    Private.foreignHandlerProperty.set(console, handler);
    console.disposed.connect(() => {
      handler.dispose();
    });
  });

  const { commands } = app;
  const category = 'Console';
  const toggleShowAllActivity = 'console:toggle-show-all-kernel-activity';

  // Get the current widget and activate unless the args specify otherwise.
  function getCurrent(args: ReadonlyJSONObject): ConsolePanel | null {
    let widget = tracker.currentWidget;
    let activate = args['activate'] !== false;
    if (activate && widget) {
      shell.activateById(widget.id);
    }
    return widget;
  }

  commands.addCommand(toggleShowAllActivity, {
    label: args => 'Show All Kernel Activity',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      const handler = Private.foreignHandlerProperty.get(current.console);
      handler.enabled = !handler.enabled;
    },
    isToggled: () =>
      tracker.currentWidget !== null &&
      Private.foreignHandlerProperty.get(tracker.currentWidget.console).enabled,
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === shell.currentWidget
  });

  if (palette) {
    palette.addItem({
      command: toggleShowAllActivity,
      category,
      args: { isPalette: true }
    });
  }

  app.contextMenu.addItem({
    command: toggleShowAllActivity,
    selector: '.jp-CodeConsole'
  });
}

/*
 * A namespace for private data.
 */
namespace Private {
  /**
   * An attached property for a console's foreign handler.
   */
  export const foreignHandlerProperty = new AttachedProperty<
    CodeConsole,
    ForeignHandler | undefined
  >({
    name: 'foreignHandler',
    create: () => undefined
  });
}
