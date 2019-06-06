// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';

import { ISettingRegistry } from '@jupyterlab/coreutils';

import { ILauncher, LauncherModel, Launcher } from '@jupyterlab/launcher';

import { toArray } from '@phosphor/algorithm';

import { JSONObject, JSONValue } from '@phosphor/coreutils';

import { Widget } from '@phosphor/widgets';

import '../style/index.css';

/**
 * The command IDs used by the launcher plugin.
 */
namespace CommandIDs {
  export const create = 'launcher:create';
}

/**
 * A service providing an interface to the the launcher.
 */
const plugin: JupyterFrontEndPlugin<ILauncher> = {
  activate,
  id: '@jupyterlab/launcher-extension:plugin',
  requires: [ICommandPalette, ILabShell, ISettingRegistry],
  provides: ILauncher,
  autoStart: true
};

/**
 * Export the plugin as default.
 */
export default plugin;

/**
 * Activate the launcher.
 */
function activate(
  app: JupyterFrontEnd,
  palette: ICommandPalette,
  labShell: ILabShell,
  settingRegistry: ISettingRegistry
): ILauncher {
  const { commands } = app;
  const model = new LauncherModel();

  Promise.all([settingRegistry.load(plugin.id), app.restored])
    .then(([settings]) => {
      let usageData = settings.get('usage-data').composite || {};
      model.fromJSON(usageData as JSONValue);
      settings.changed.connect(settings => {
        usageData = settings.get('usage-data').composite || {};
        model.fromJSON(usageData as JSONValue);
      });
    })
    .catch(err => {
      console.log('error while saving recent usage');
    });

  commands.addCommand(CommandIDs.create, {
    label: 'New Launcher',
    execute: (args: JSONObject) => {
      const cwd = args['cwd'] ? String(args['cwd']) : '';
      const id = `launcher-${Private.id++}`;
      const callback = (item: Widget) => {
        labShell.add(item, 'main', { ref: id });
      };
      const launcher = new Launcher({ cwd, callback, commands });

      launcher.model = model;
      launcher.model.setSettingRegistey(settingRegistry);
      launcher.title.label = 'Launcher';
      launcher.title.iconClass = 'jp-LauncherIcon';

      let main = new MainAreaWidget({ content: launcher });

      // If there are any other widgets open, remove the launcher close icon.
      main.title.closable = !!toArray(labShell.widgets('main')).length;
      main.id = id;

      labShell.add(main, 'main', { activate: args['activate'] as boolean });

      labShell.layoutModified.connect(() => {
        // If there is only a launcher open, remove the close icon.
        main.title.closable = toArray(labShell.widgets('main')).length > 1;
      }, main);

      return main;
    }
  });

  palette.addItem({ command: CommandIDs.create, category: 'Launcher' });

  return model;
}

/**
 * The namespace for module private data.
 */
namespace Private {
  /**
   * The incrementing id used for launcher widgets.
   */
  export let id = 0;
}
