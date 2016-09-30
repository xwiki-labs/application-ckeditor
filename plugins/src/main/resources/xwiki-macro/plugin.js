/*
 * See the NOTICE file distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this software; if not, write to the Free
 * Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA, or see the FSF site: http://www.fsf.org.
 */
(function() {
  'use strict';
  var $ = jQuery;
  CKEDITOR.plugins.add('xwiki-macro', {
    requires: 'widget,notification,xwiki-marker,xwiki-source',
    init : function(editor) {
      var macroPlugin = this;

      // node: CKEDITOR.htmlParser.node
      var isInlineNode = function(node) {
        return node.type !== CKEDITOR.NODE_ELEMENT || CKEDITOR.dtd.$inline[node.name];
      };

      // node: CKEDITOR.htmlParser.node
      var getPreviousSibling = function(node, siblingTypes) {
        var i = node.getIndex() - 1;
        while (i >= 0) {
          var sibling = node.parent.children[i--];
          if (!siblingTypes || siblingTypes.indexOf(sibling.type) >= 0) {
            return sibling;
          }
        }
        return null;
      };

      // node: CKEDITOR.htmlParser.node
      var getNextSibling = function(node, siblingTypes) {
        var i = node.getIndex() + 1;
        while (i < node.parent.children.length) {
          var sibling = node.parent.children[i++];
          if (!siblingTypes || siblingTypes.indexOf(sibling.type) >= 0) {
            return sibling;
          }
        }
        return null;
      };

      // startMacroComment: CKEDITOR.htmlParser.comment
      // output: CKEDITOR.htmlParser.node[]
      var isInlineMacro = function(startMacroComment, output) {
        if (output.length > 0) {
          var i = 0;
          while (i < output.length && isInlineNode(output[i])) {
            i++;
          }
          return i >= output.length;
        } else {
          var previousSibling = getPreviousSibling(startMacroComment, [CKEDITOR.NODE_ELEMENT, CKEDITOR.NODE_TEXT]);
          var nextSibling = getNextSibling(startMacroComment, [CKEDITOR.NODE_ELEMENT, CKEDITOR.NODE_TEXT]);
          if (previousSibling || nextSibling) {
            return (previousSibling && isInlineNode(previousSibling)) || (nextSibling && isInlineNode(nextSibling));
          } else {
            return !CKEDITOR.dtd.$blockLimit[startMacroComment.parent.name];
          }
        }
      };

      // startMacroComment: CKEDITOR.htmlParser.comment
      // output: CKEDITOR.htmlParser.node[]
      var wrapMacroOutput = function(startMacroComment, output) {
        var wrapperName = isInlineMacro(startMacroComment, output) ? 'span' : 'div';
        var macroModule = null;
        if(editor.config.macroModules && editor.config.macrodules[macroCall.name]) {
          macroModule = editor.config.macrodules[macroCall.name];
        }
        var wrapper = macroModule ?  new CKEDITOR.htmlParser.element(wrapperName) :
            new CKEDITOR.htmlParser.element(wrapperName, {
              'class': 'macro',
              'data-macro': startMacroComment.value
            });
        if (output.length > 0) {
          for (var i = 0; i < output.length; i++) {
            output[i].remove();
            wrapper.add(output[i]);
          }
        } else {
          var macroCall = macroPlugin.parseMacroCall(startMacroComment.value);
          var placeholder = null;
          // a macroModule may be providing the services of editing these macros
          if(macroModule) {
            placeholder = macroModule.activate(phText, macroCall);
          }
          // If not provided, use a placeholder for the macro output so that the user can edit the macro .
          if(!placeholder) {
            placeholder = new CKEDITOR.htmlParser.element(wrapperName, {'class': 'macro-placeholder'});
            var phText = new CKEDITOR.htmlParser.text('macro:' + macroCall.name);
            placeholder.add(phText);
          }
          wrapper.add(placeholder);
        }

        startMacroComment.replaceWith(wrapper);
      };

      editor.plugins['xwiki-marker'].addMarkerHandler(editor, 'macro', {
        toHtml: wrapMacroOutput
      });

      // macroOutputWrapper: CKEDITOR.htmlParser.element
      var unWrapMacroOutput = function(macroOutputWrapper) {
        var startMacroComment = new CKEDITOR.htmlParser.comment(macroOutputWrapper.attributes['data-macro']);
        var stopMacroComment = new CKEDITOR.htmlParser.comment('stopmacro');
        var macro = new CKEDITOR.htmlParser.fragment();
        macro.add(startMacroComment);
        if (editor.config.fullData) {
          macroOutputWrapper.children.forEach(function(child) {
            macro.add(child);
          });
        }
        macro.add(stopMacroComment);
        return macro;
      };

      editor.ui.addButton('xwiki-macro', {
        label: 'XWiki Macro',
        command: 'xwiki-macro',
        toolbar: 'insert,40'
      });

      // See http://docs.ckeditor.com/#!/api/CKEDITOR.plugins.widget.definition
      editor.widgets.add('xwiki-macro', {
        requiredContent: 'div(macro)[data-macro]; span(macro)[data-macro]',
        template: '<span class="macro" data-macro=""><span class="macro-placeholder">macro:name</span></span>',
        dialog: 'xwiki-macro',
        pathName: 'macro',
        upcast: function(element) {
          return (element.name == 'div' || element.name == 'span') &&
            element.hasClass('macro') && element.attributes['data-macro'];
        },
        downcast: unWrapMacroOutput,
        init: function() {
          this.setData(macroPlugin.parseMacroCall(this.element.getAttribute('data-macro')));
        },
        data: function(event) {
          this.element.setAttribute('data-macro', macroPlugin.serializeMacroCall(this.data));
          this.pathName = 'macro:' + this.data.name;
          // The elementspath plugin takes the path name from the 'data-cke-display-name' attribute which is set by the
          // widget plugin only once, based on the initial pathName property from the widget definition. We have to
          // update the attribute ourselves in order to have a dynamic path name (since the user can change the macro).
          this.wrapper.data('cke-display-name', this.pathName);
          $(this.element.$).find('.macro-placeholder').text(this.pathName);
        },
        edit: function(event) {
          var widget = this;
          // Override the next call to openDialog in order to hook our custom dialog.
          var openDialog = this.editor.openDialog;
          this.editor.openDialog = function(dialogName, callback) {
            // Restore the original function.
            this.openDialog = openDialog;
            // Create a fake CKEditor dialog in order for the widget to add its listeners.
            var dialog = {};
            CKEDITOR.event.implementOn(dialog);
            widget.fire('dialog', dialog);
            // Show our custom dialog.
            require(['macroWizard'], function(macroWizard) {
              macroWizard(widget.data).done(function(macroCall) {
                // Prevent the editor from recording a history entry where the macro data is updated but the macro
                // output is not refreshed. The lock is removed by the call to setLoading(false) after the macro output
                // is refreshed.
                editor.fire('lockSnapshot', {dontUpdate: true});
                widget.setData(macroCall);
                dialog.fire('ok');
                setTimeout($.proxy(editor, 'execCommand', 'xwiki-refresh'), 0);
              }).fail(function() {
                dialog.fire('cancel');
              }).always(function() {
                dialog.fire('hide');
              });
            });
          };
        }
      });

      editor.addCommand('xwiki-refresh', {
        async: true,
        exec: function(editor) {
          var command = this;
          editor.plugins['xwiki-source'].setLoading(editor, true);
          var config = editor.config['xwiki-source'] || {};
          $.post(config.htmlConverter, {
            fromHTML: true,
            toHTML: true,
            text: editor.getData()
          }).done(function(html) {
            editor.setData(html, {callback: $.proxy(command, 'done', true)});
          }).fail($.proxy(this, 'done'));
        },
        done: function(success) {
          editor.plugins['xwiki-source'].setLoading(editor, false);
          if (!success) {
            editor.showNotification('Failed to refresh the edited content.', 'warning');
          }
          editor.fire('afterCommandExec', {name: this.name, command: this});
        }
      });
    },

    parseMacroCall: function(startMacroComment) {
      // Unescape the text of the start macro comment.
      var text = CKEDITOR.tools.unescapeComment(startMacroComment);

      // Extract the macro name.
      var separator = '|-|';
      var start = 'startmacro:'.length;
      var end = text.indexOf(separator, start);
      var macroCall = {
        name: text.substring(start, end),
        parameters: {}
      };

      // Extract the macro parameters.
      start = end + separator.length;
      var separatorIndex = CKEDITOR.plugins.xwikiMarker.parseParameters(text, macroCall.parameters,
        start, separator, true);

      // Extract the macro content, if specified.
      if (separatorIndex >= 0) {
        macroCall.content = text.substring(separatorIndex + separator.length);
      }

      return macroCall;
    },

    serializeMacroCall: function(macroCall) {
      var separator = '|-|';
      var output = ['startmacro:', macroCall.name, separator,
        CKEDITOR.plugins.xwikiMarker.serializeParameters(macroCall.parameters)];
      if (typeof macroCall.content === 'string') {
        output.push(separator, macroCall.content);
      }
      return CKEDITOR.tools.escapeComment(output.join(''));
    },

    // updates the content of the comment at previousSibling
    // (or creates it if not a startMacro comment
    macroContentUpdated: function(domElement, macroCall) {
      var startMacroComment = domElement.previousSibling;
      window.lastDomElement = domElement;
      var serialization = this.serializeMacroCall(macroCall);
      if(! (startMacroComment && startMacroComment.nodeName == "#comment")) {
        startMacroComment = document.createComment(serialization);
        domElement.parentNode.insertBefore(startMacroComment, domElement);
        var endMacroComment = document.createComment("stopmacro");
        domElement.parentNode.insertBefore(endMacroComment, domElement.nextSibling);
      } else {
        startMacroComment.data = serialization;
      }
    }


  });
})();
