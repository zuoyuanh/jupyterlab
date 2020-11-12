// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { UseSignal, ReactWidget } from './vdom';

import { Kernel } from '@jupyterlab/services';

import { Button, DefaultIconReact } from '@jupyterlab/ui-components';

import { IIterator, find, map, some } from '@phosphor/algorithm';

import { CommandRegistry } from '@phosphor/commands';

import { Message, MessageLoop } from '@phosphor/messaging';

import { AttachedProperty } from '@phosphor/properties';

import { PanelLayout, Widget } from '@phosphor/widgets';

import { IClientSession } from './clientsession';

import * as React from 'react';
import { ReadonlyJSONObject } from '@phosphor/coreutils';

/**
 * The class name added to toolbars.
 */
const TOOLBAR_CLASS = 'jp-Toolbar';

/**
 * The class name added to toolbar items.
 */
const TOOLBAR_ITEM_CLASS = 'jp-Toolbar-item';

/**
 * The class name added to toolbar kernel name text.
 */
const TOOLBAR_KERNEL_NAME_CLASS = 'jp-Toolbar-kernelName';

/**
 * The class name added to toolbar spacer.
 */
const TOOLBAR_SPACER_CLASS = 'jp-Toolbar-spacer';

/**
 * The class name added to toolbar kernel status icon.
 */
const TOOLBAR_KERNEL_STATUS_CLASS = 'jp-Toolbar-kernelStatus';

/**
 * The class name added to a busy kernel indicator.
 */
const TOOLBAR_BUSY_CLASS = 'jp-FilledCircleIcon';

const TOOLBAR_IDLE_CLASS = 'jp-CircleIcon';

/**
 * A layout for toolbars.
 *
 * #### Notes
 * This layout automatically collapses its height if there are no visible
 * toolbar widgets, and expands to the standard toolbar height if there are
 * visible toolbar widgets.
 */
class ToolbarLayout extends PanelLayout {
  /**
   * A message handler invoked on a `'fit-request'` message.
   *
   * If any child widget is visible, expand the toolbar height to the normal
   * toolbar height.
   */
  protected onFitRequest(msg: Message): void {
    super.onFitRequest(msg);
    if (this.parent!.isAttached) {
      // If there are any widgets not explicitly hidden, expand the toolbar to
      // accommodate them.
      if (some(this.widgets, w => !w.isHidden)) {
        this.parent!.node.style.minHeight = 'var(--jp-private-toolbar-height)';
      } else {
        this.parent!.node.style.minHeight = '';
      }
    }

    // Set the dirty flag to ensure only a single update occurs.
    this._dirty = true;

    // Notify the ancestor that it should fit immediately. This may
    // cause a resize of the parent, fulfilling the required update.
    if (this.parent!.parent) {
      MessageLoop.sendMessage(this.parent!.parent!, Widget.Msg.FitRequest);
    }

    // If the dirty flag is still set, the parent was not resized.
    // Trigger the required update on the parent widget immediately.
    if (this._dirty) {
      MessageLoop.sendMessage(this.parent!, Widget.Msg.UpdateRequest);
    }
  }

  /**
   * A message handler invoked on an `'update-request'` message.
   */
  protected onUpdateRequest(msg: Message): void {
    super.onUpdateRequest(msg);
    if (this.parent!.isVisible) {
      this._dirty = false;
    }
  }

  /**
   * A message handler invoked on a `'child-shown'` message.
   */
  protected onChildShown(msg: Widget.ChildMessage): void {
    super.onChildShown(msg);

    // Post a fit request for the parent widget.
    this.parent!.fit();
  }

  /**
   * A message handler invoked on a `'child-hidden'` message.
   */
  protected onChildHidden(msg: Widget.ChildMessage): void {
    super.onChildHidden(msg);

    // Post a fit request for the parent widget.
    this.parent!.fit();
  }

  /**
   * A message handler invoked on a `'before-attach'` message.
   */
  protected onBeforeAttach(msg: Message): void {
    super.onBeforeAttach(msg);

    // Post a fit request for the parent widget.
    this.parent!.fit();
  }

  /**
   * Attach a widget to the parent's DOM node.
   *
   * @param index - The current index of the widget in the layout.
   *
   * @param widget - The widget to attach to the parent.
   *
   * #### Notes
   * This is a reimplementation of the superclass method.
   */
  protected attachWidget(index: number, widget: Widget): void {
    super.attachWidget(index, widget);

    // Post a fit request for the parent widget.
    this.parent!.fit();
  }

  /**
   * Detach a widget from the parent's DOM node.
   *
   * @param index - The previous index of the widget in the layout.
   *
   * @param widget - The widget to detach from the parent.
   *
   * #### Notes
   * This is a reimplementation of the superclass method.
   */
  protected detachWidget(index: number, widget: Widget): void {
    super.detachWidget(index, widget);

    // Post a fit request for the parent widget.
    this.parent!.fit();
  }

  private _dirty = false;
}

/**
 * A class which provides a toolbar widget.
 */
export class Toolbar<T extends Widget = Widget> extends Widget {
  /**
   * Construct a new toolbar widget.
   */
  constructor() {
    super();
    this.addClass(TOOLBAR_CLASS);
    this.layout = new ToolbarLayout();
  }

  /**
   * Get an iterator over the ordered toolbar item names.
   *
   * @returns An iterator over the toolbar item names.
   */
  names(): IIterator<string> {
    let layout = this.layout as ToolbarLayout;
    return map(layout.widgets, widget => {
      return Private.nameProperty.get(widget);
    });
  }

  /**
   * Add an item to the end of the toolbar.
   *
   * @param name - The name of the widget to add to the toolbar.
   *
   * @param widget - The widget to add to the toolbar.
   *
   * @param index - The optional name of the item to insert after.
   *
   * @returns Whether the item was added to toolbar.  Returns false if
   *   an item of the same name is already in the toolbar.
   *
   * #### Notes
   * The item can be removed from the toolbar by setting its parent to `null`.
   */
  addItem(name: string, widget: T): boolean {
    let layout = this.layout as ToolbarLayout;
    return this.insertItem(layout.widgets.length, name, widget);
  }

  /**
   * Insert an item into the toolbar at the specified index.
   *
   * @param index - The index at which to insert the item.
   *
   * @param name - The name of the item.
   *
   * @param widget - The widget to add.
   *
   * @returns Whether the item was added to the toolbar. Returns false if
   *   an item of the same name is already in the toolbar.
   *
   * #### Notes
   * The index will be clamped to the bounds of the items.
   * The item can be removed from the toolbar by setting its parent to `null`.
   */
  insertItem(index: number, name: string, widget: T): boolean {
    let existing = find(this.names(), value => value === name);
    if (existing) {
      return false;
    }
    widget.addClass(TOOLBAR_ITEM_CLASS);
    let layout = this.layout as ToolbarLayout;
    layout.insertWidget(index, widget);
    Private.nameProperty.set(widget, name);
    return true;
  }

  /**
   * Insert an item into the toolbar at the after a target item.
   *
   * @param at - The target item to insert after.
   *
   * @param name - The name of the item.
   *
   * @param widget - The widget to add.
   *
   * @returns Whether the item was added to the toolbar. Returns false if
   *   an item of the same name is already in the toolbar.
   *
   * #### Notes
   * The index will be clamped to the bounds of the items.
   * The item can be removed from the toolbar by setting its parent to `null`.
   */
  insertAfter(at: string, name: string, widget: T): boolean {
    return this._insertRelative(at, 1, name, widget);
  }

  /**
   * Insert an item into the toolbar at the before a target item.
   *
   * @param at - The target item to insert before.
   *
   * @param name - The name of the item.
   *
   * @param widget - The widget to add.
   *
   * @returns Whether the item was added to the toolbar. Returns false if
   *   an item of the same name is already in the toolbar.
   *
   * #### Notes
   * The index will be clamped to the bounds of the items.
   * The item can be removed from the toolbar by setting its parent to `null`.
   */
  insertBefore(at: string, name: string, widget: T): boolean {
    return this._insertRelative(at, 0, name, widget);
  }

  private _insertRelative(
    at: string,
    offset: number,
    name: string,
    widget: T
  ): boolean {
    let nameWithIndex = map(this.names(), (name, i) => {
      return { name: name, index: i };
    });
    let target = find(nameWithIndex, x => x.name === at);
    if (target) {
      return this.insertItem(target.index + offset, name, widget);
    }
    return false;
  }

  /**
   * Handle the DOM events for the widget.
   *
   * @param event - The DOM event sent to the widget.
   *
   * #### Notes
   * This method implements the DOM `EventListener` interface and is
   * called in response to events on the dock panel's node. It should
   * not be called directly by user code.
   */
  handleEvent(event: Event): void {
    switch (event.type) {
      case 'click':
        this.handleClick(event);
        break;
      default:
        break;
    }
  }

  /**
   * Handle a DOM click event.
   */
  protected handleClick(event: Event) {
    // Clicking a label focuses the corresponding control, so let it be.
    if (event.target instanceof HTMLLabelElement) {
      return;
    }

    // If this click already focused a control, let it be.
    if (this.node.contains(document.activeElement)) {
      return;
    }

    // Otherwise, activate the parent widget, which may take focus if desired.
    if (this.parent) {
      this.parent.activate();
    }
  }

  /**
   * Handle `after-attach` messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    this.node.addEventListener('click', this);
  }

  /**
   * Handle `before-detach` messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    this.node.removeEventListener('click', this);
  }
}

/**
 * The namespace for Toolbar class statics.
 */
export namespace Toolbar {
  /**
   * Create an interrupt toolbar item.
   */
  export function createInterruptButton(session: IClientSession): Widget {
    return new ToolbarButton({
      iconClassName: 'jp-StopIcon',
      onClick: () => {
        if (session.kernel) {
          void session.kernel.interrupt();
        }
      },
      tooltip: 'Interrupt the kernel'
    });
  }

  /**
   * Create a restart toolbar item.
   */
  export function createRestartButton(session: IClientSession): Widget {
    return new ToolbarButton({
      iconClassName: 'jp-RefreshIcon',
      onClick: () => {
        void session.restart();
      },
      tooltip: 'Restart the kernel'
    });
  }

  /**
   * Create a toolbar spacer item.
   *
   * #### Notes
   * It is a flex spacer that separates the left toolbar items
   * from the right toolbar items.
   */
  export function createSpacerItem(): Widget {
    return new Private.Spacer();
  }

  /**
   * Create a kernel name indicator item.
   *
   * #### Notes
   * It will display the `'display_name`' of the current kernel,
   * or `'No Kernel'` if there is no kernel.
   * It can handle a change in context or kernel.
   */
  export function createKernelNameItem(session: IClientSession): Widget {
    const el = ReactWidget.create(
      <Private.KernelNameComponent session={session} />
    );
    el.addClass('jp-KernelName');
    return el;
  }

  /**
   * Create a kernel status indicator item.
   *
   * #### Notes
   * It will show a busy status if the kernel status is busy.
   * It will show the current status in the node title.
   * It can handle a change to the context or the kernel.
   */
  export function createKernelStatusItem(session: IClientSession): Widget {
    return new Private.KernelStatus(session);
  }
}

/**
 * Namespace for ToolbarButtonComponent.
 */
export namespace ToolbarButtonComponent {
  /**
   * Interface for ToolbarButttonComponent props.
   */
  export interface IProps {
    className?: string;
    label?: string;
    iconClassName?: string;
    iconLabel?: string;
    tooltip?: string;
    onClick?: () => void;
    enabled?: boolean;
  }
}

/**
 * React component for a toolbar button.
 *
 * @param props - The props for ToolbarButtonComponent.
 */
export function ToolbarButtonComponent(props: ToolbarButtonComponent.IProps) {
  // In some browsers, a button click event moves the focus from the main
  // content to the button (see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#Clicking_and_focus).
  // We avoid a click event by calling preventDefault in mousedown, and
  // we bind the button action to `mousedown`.
  const handleMouseDown = (event: React.MouseEvent) => {
    // Fire action only when left button is pressed.
    if (event.button === 0) {
      event.preventDefault();
      props.onClick();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const { key } = event;
    if (key === 'Enter' || key === ' ') {
      props.onClick();
    }
  };

  return (
    <Button
      className={
        props.className
          ? props.className + ' jp-ToolbarButtonComponent'
          : 'jp-ToolbarButtonComponent'
      }
      disabled={props.enabled === false}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      title={props.tooltip || props.iconLabel}
      minimal
    >
      {props.iconClassName && (
        <DefaultIconReact
          name={`${props.iconClassName} jp-Icon jp-Icon-16`}
          className={'jp-ToolbarButtonComponent-icon'}
          fallback={true}
          center={true}
          kind={'toolbarButton'}
          tag={'span'}
        />
      )}
      {props.label && (
        <span className="jp-ToolbarButtonComponent-label">{props.label}</span>
      )}
    </Button>
  );
}

/**
 * Adds the toolbar button class to the toolbar widget.
 * @param w Toolbar button widget.
 */
export function addToolbarButtonClass(w: Widget): Widget {
  w.addClass('jp-ToolbarButton');
  return w;
}

/**
 * Phosphor Widget version of static ToolbarButtonComponent.
 */
export class ToolbarButton extends ReactWidget {
  /**
   * Creates a toolbar button
   * @param props props for underlying `ToolbarButton` componenent
   */
  constructor(private props: ToolbarButtonComponent.IProps = {}) {
    super();
    addToolbarButtonClass(this);
  }
  render() {
    return <ToolbarButtonComponent {...this.props} />;
  }
}

/**
 * Namespace for CommandToolbarButtonComponent.
 */
export namespace CommandToolbarButtonComponent {
  /**
   * Interface for CommandToolbarButtonComponent props.
   */
  export interface IProps {
    commands: CommandRegistry;
    id: string;
    args?: ReadonlyJSONObject;
  }
}

/**
 * React component for a toolbar button that wraps a command.
 *
 * This wraps the ToolbarButtonComponent and watches the command registry
 * for changes to the command.
 */
export function CommandToolbarButtonComponent(
  props: CommandToolbarButtonComponent.IProps
) {
  return (
    <UseSignal
      signal={props.commands.commandChanged}
      shouldUpdate={(sender, args) =>
        (args.id === props.id && args.type === 'changed') ||
        args.type === 'many-changed'
      }
    >
      {() => <ToolbarButtonComponent {...Private.propsFromCommand(props)} />}
    </UseSignal>
  );
}

/*
 * Adds the command toolbar button class to the command toolbar widget.
 * @param w Command toolbar button widget.
 */
export function addCommandToolbarButtonClass(w: Widget): Widget {
  w.addClass('jp-CommandToolbarButton');
  return w;
}

/**
 * Phosphor Widget version of CommandToolbarButtonComponent.
 */
export class CommandToolbarButton extends ReactWidget {
  /**
   * Creates a command toolbar button
   * @param props props for underlying `CommandToolbarButtonComponent` componenent
   */
  constructor(private props: CommandToolbarButtonComponent.IProps) {
    super();
    addCommandToolbarButtonClass(this);
  }
  render() {
    return <CommandToolbarButtonComponent {...this.props} />;
  }
}

/**
 * A namespace for private data.
 */
namespace Private {
  export function propsFromCommand(
    options: CommandToolbarButtonComponent.IProps
  ): ToolbarButtonComponent.IProps {
    let { commands, id, args } = options;
    const iconClassName = commands.iconClass(id, args);
    const iconLabel = commands.iconLabel(id, args);
    const label = commands.label(id, args);
    let className = commands.className(id, args);
    // Add the boolean state classes.
    if (commands.isToggled(id, args)) {
      className += ' p-mod-toggled';
    }
    if (!commands.isVisible(id, args)) {
      className += ' p-mod-hidden';
    }
    const tooltip = commands.caption(id, args) || label || iconLabel;
    const onClick = () => {
      void commands.execute(id, {
        actionMetadata: {
          from: TOOLBAR_CLASS,
          how: 'click'
        },
        ...args
      });
    };
    const enabled = commands.isEnabled(id, args);
    return { className, iconClassName, tooltip, onClick, enabled, label };
  }

  /**
   * An attached property for the name of a toolbar item.
   */
  export const nameProperty = new AttachedProperty<Widget, string>({
    name: 'name',
    create: () => ''
  });

  /**
   * A no-op function.
   */
  export function noOp() {
    /* no-op */
  }

  /**
   * A spacer widget.
   */
  export class Spacer extends Widget {
    /**
     * Construct a new spacer widget.
     */
    constructor() {
      super();
      this.addClass(TOOLBAR_SPACER_CLASS);
    }
  }

  /**
   * Namespace for KernelNameComponent.
   */
  export namespace KernelNameComponent {
    /**
     * Interface for KernelNameComponent props.
     */
    export interface IProps {
      session: IClientSession;
    }
  }

  /**
   * React component for a kernel name button.
   *
   * This wraps the ToolbarButtonComponent and watches the kernel
   * session for changes.
   */

  export function KernelNameComponent(props: KernelNameComponent.IProps) {
    return (
      <UseSignal
        signal={props.session.kernelChanged}
        initialSender={props.session}
      >
        {session => (
          <ToolbarButtonComponent
            className={TOOLBAR_KERNEL_NAME_CLASS}
            onClick={props.session.selectKernel.bind(props.session)}
            tooltip={'Switch kernel'}
            label={session.kernelDisplayName}
          />
        )}
      </UseSignal>
    );
  }

  /**
   * A toolbar item that displays kernel status.
   */
  export class KernelStatus extends Widget {
    /**
     * Construct a new kernel status widget.
     */
    constructor(session: IClientSession) {
      super();
      this.addClass(TOOLBAR_KERNEL_STATUS_CLASS);
      this._onStatusChanged(session);
      session.statusChanged.connect(this._onStatusChanged, this);
    }

    /**
     * Handle a status on a kernel.
     */
    private _onStatusChanged(session: IClientSession) {
      if (this.isDisposed) {
        return;
      }
      let status = session.status;
      const busy = this._isBusy(status);
      this.toggleClass(TOOLBAR_BUSY_CLASS, busy);
      this.toggleClass(TOOLBAR_IDLE_CLASS, !busy);
      let title = 'Kernel ' + status[0].toUpperCase() + status.slice(1);
      this.node.title = title;
    }

    /**
     * Check if status should be shown as busy.
     */
    private _isBusy(status: Kernel.Status): boolean {
      return (
        status === 'busy' || status === 'starting' || status === 'restarting'
      );
    }
  }
}
