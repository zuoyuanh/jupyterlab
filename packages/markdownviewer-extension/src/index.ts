// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { InstanceTracker } from '@jupyterlab/apputils';

import { ISettingRegistry } from '@jupyterlab/coreutils';

import {
  IRenderMimeRegistry,
  markdownRendererFactory
} from '@jupyterlab/rendermime';

import {
  MarkdownViewer,
  MarkdownViewerFactory,
  MarkdownDocument,
  IMarkdownViewerTracker
} from '@jupyterlab/markdownviewer';

/**
 * The command IDs used by the markdownviewer plugin.
 */
namespace CommandIDs {
  export const markdownPreview = 'markdownviewer:open';
}

/**
 * The name of the factory that creates markdown viewer widgets.
 */
const FACTORY = 'Markdown Preview';

/**
 * The markdown viewer plugin.
 */
const plugin: JupyterFrontEndPlugin<IMarkdownViewerTracker> = {
  activate,
  id: '@jupyterlab/markdownviewer-extension:plugin',
  provides: IMarkdownViewerTracker,
  requires: [ILayoutRestorer, IRenderMimeRegistry, ISettingRegistry],
  autoStart: true
};

/**
 * Activate the markdown viewer plugin.
 */
function activate(
  app: JupyterFrontEnd,
  restorer: ILayoutRestorer,
  rendermime: IRenderMimeRegistry,
  settingRegistry: ISettingRegistry
): IMarkdownViewerTracker {
  const { commands, docRegistry } = app;

  // Add the markdown renderer factory.
  rendermime.addFactory(markdownRendererFactory);

  const namespace = 'markdownviewer-widget';
  const tracker = new InstanceTracker<MarkdownDocument>({
    namespace
  });

  let config: Partial<MarkdownViewer.IConfig> = {
    ...MarkdownViewer.defaultConfig
  };

  /**
   * Update the settings of a widget.
   */
  function updateWidget(widget: MarkdownViewer): void {
    Object.keys(config).forEach((k: keyof MarkdownViewer.IConfig) => {
      widget.setOption(k, config[k]);
    });
  }

  /**
   * Update the setting values.
   */
  function updateSettings(settings: ISettingRegistry.ISettings) {
    config = settings.composite as Partial<MarkdownViewer.IConfig>;
    tracker.forEach(widget => {
      updateWidget(widget.content);
    });
  }

  // Fetch the initial state of the settings.
  settingRegistry
    .load(plugin.id)
    .then((settings: ISettingRegistry.ISettings) => {
      settings.changed.connect(() => {
        updateSettings(settings);
      });
      updateSettings(settings);
    })
    .catch((reason: Error) => {
      console.error(reason.message);
    });

  // Register the MarkdownViewer factory.
  const factory = new MarkdownViewerFactory({
    rendermime,
    name: FACTORY,
    primaryFileType: docRegistry.getFileType('markdown'),
    fileTypes: ['markdown'],
    defaultRendered: ['markdown']
  });
  factory.widgetCreated.connect((sender, widget) => {
    // Notify the instance tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => {
      tracker.save(widget);
    });
    // Handle the settings of new widgets.
    updateWidget(widget.content);
    tracker.add(widget);
  });
  docRegistry.addWidgetFactory(factory);

  // Handle state restoration.
  restorer.restore(tracker, {
    command: 'docmanager:open',
    args: widget => ({ path: widget.context.path, factory: FACTORY }),
    name: widget => widget.context.path
  });

  commands.addCommand(CommandIDs.markdownPreview, {
    label: 'Markdown Preview',
    execute: args => {
      let path = args['path'];
      if (typeof path !== 'string') {
        return;
      }
      return commands.execute('docmanager:open', {
        path,
        factory: FACTORY,
        options: args['options']
      });
    }
  });

  return tracker;
}

/**
 * Export the plugin as default.
 */
export default plugin;
