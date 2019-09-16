import Backbone from 'backbone';
import { Events } from 'framework/events';
import { MenuSectionCollection } from 'collections/menu/menu-section-collection';
import { Colors } from 'const/colors';
import { Keys } from 'const/keys';
import { GroupsMenuModel } from 'models/menu/groups-menu-model';
import { MenuSectionModel } from 'models/menu/menu-section-model';
import { StringFormat } from 'util/formatting/string-format';
import { Locale } from 'util/locale';

const MenuModel = Backbone.Model.extend({
    defaults: {
        sections: null
    },

    menus: null,

    initialize() {
        this.menus = {};
        this.allItemsSection = new MenuSectionModel([
            {
                locTitle: 'menuAllItems',
                icon: 'th-large',
                active: true,
                shortcut: Keys.DOM_VK_A,
                filterKey: '*'
            }
        ]);
        this.allItemsItem = this.allItemsSection.get('items').models[0];
        this.groupsSection = new GroupsMenuModel();
        this.colorsSection = new MenuSectionModel([
            {
                locTitle: 'menuColors',
                icon: 'bookmark',
                shortcut: Keys.DOM_VK_C,
                cls: 'menu__item-colors',
                filterKey: 'color',
                filterValue: true
            }
        ]);
        this.colorsItem = this.colorsSection.get('items').models[0];
        const defTags = [this._getDefaultTagItem()];
        this.tagsSection = new MenuSectionModel(defTags);
        this.tagsSection.set({ scrollable: true, drag: true });
        this.tagsSection.defaultItems = defTags;
        this.trashSection = new MenuSectionModel([
            {
                locTitle: 'menuTrash',
                icon: 'trash',
                shortcut: Keys.DOM_VK_D,
                filterKey: 'trash',
                filterValue: true,
                drop: true
            }
        ]);
        Colors.AllColors.forEach(color => {
            const option = {
                cls: 'fa ' + color + '-color',
                value: color,
                filterValue: color
            };
            this.colorsSection.get('items').models[0].addOption(option);
        });
        this.menus.app = new MenuSectionCollection([
            this.allItemsSection,
            this.colorsSection,
            this.tagsSection,
            this.groupsSection,
            this.trashSection
        ]);

        this.generalSection = new MenuSectionModel([
            { locTitle: 'menuSetGeneral', icon: 'cog', page: 'general', active: true }
        ]);
        this.shortcutsSection = new MenuSectionModel([
            { locTitle: 'shortcuts', icon: 'keyboard-o', page: 'shortcuts' }
        ]);
        this.pluginsSection = new MenuSectionModel([
            { locTitle: 'plugins', icon: 'puzzle-piece', page: 'plugins' }
        ]);
        this.aboutSection = new MenuSectionModel([
            { locTitle: 'menuSetAbout', icon: 'info', page: 'about' }
        ]);
        this.helpSection = new MenuSectionModel([
            { locTitle: 'help', icon: 'question', page: 'help' }
        ]);
        this.filesSection = new MenuSectionModel();
        this.filesSection.set({ scrollable: true, grow: true });
        this.menus.settings = new MenuSectionCollection([
            this.generalSection,
            this.shortcutsSection,
            this.pluginsSection,
            this.aboutSection,
            this.helpSection,
            this.filesSection
        ]);
        this.set('sections', this.menus.app);

        this.listenTo(Events, 'set-locale', this._setLocale);
        this.listenTo(Events, 'select-next-menu-item', this._selectNext);
        this.listenTo(Events, 'select-previous-menu-item', this._selectPrevious);
        this._setLocale();
    },

    select(sel) {
        const sections = this.get('sections');
        sections.forEach(function(section) {
            this._select(section, sel.item);
        }, this);
        if (sections === this.menus.app) {
            this.colorsItem.get('options').forEach(opt => opt.set('active', opt === sel.option));
            const selColor =
                sel.item === this.colorsItem && sel.option
                    ? sel.option.get('value') + '-color'
                    : '';
            this.colorsItem.set('cls', 'menu__item-colors ' + selColor);
            const filterKey = sel.item.get('filterKey');
            const filterValue = (sel.option || sel.item).get('filterValue');
            const filter = {};
            filter[filterKey] = filterValue;
            Events.emit('set-filter', filter);
        } else if (sections === this.menus.settings) {
            Events.emit('set-page', {
                page: sel.item.get('page'),
                file: sel.item.get('file')
            });
        }
    },

    _selectPrevious() {
        let previousItem = null;

        const processSection = section => {
            if (section.has('visible') && !section.get('visible')) {
                return true;
            }
            if (section.has('active')) {
                previousItem = section;
            }
            const items = section.get('items');
            if (items) {
                items.forEach(it => {
                    if (it.get('active') && previousItem) {
                        this.select({ item: previousItem });
                        return false;
                    }
                    return processSection(it);
                });
            }
        };

        const sections = this.get('sections');
        sections.forEach(section => processSection(section));
    },

    _selectNext() {
        let activeItem = null;

        const processSection = section => {
            if (section.has('visible') && !section.get('visible')) {
                return true;
            }
            if (section.has('active') && activeItem && section !== activeItem) {
                this.select({ item: section });
                activeItem = null;
                return false;
            }
            const items = section.get('items');
            if (items) {
                items.forEach(it => {
                    if (it.get('active')) {
                        activeItem = it;
                    }
                    return processSection(it);
                });
            }
        };

        const sections = this.get('sections');
        sections.forEach(section => processSection(section));
    },

    _select(item, selectedItem) {
        const items = item.get('items');
        if (items) {
            items.forEach(function(it) {
                it.set('active', it === selectedItem);
                this._select(it, selectedItem);
            }, this);
        }
    },

    _setLocale() {
        [this.menus.app, this.menus.settings].forEach(menu => {
            menu.each(section =>
                section.get('items').each(item => {
                    if (item.get('locTitle')) {
                        item.set('title', StringFormat.capFirst(Locale[item.get('locTitle')]));
                    }
                })
            );
        });
        this.tagsSection.defaultItems[0] = this._getDefaultTagItem();
    },

    _getDefaultTagItem() {
        return {
            title: StringFormat.capFirst(Locale.tags),
            icon: 'tags',
            defaultItem: true,
            disabled: {
                header: Locale.menuAlertNoTags,
                body: Locale.menuAlertNoTagsBody,
                icon: 'tags'
            }
        };
    },

    setMenu(type) {
        this.set('sections', this.menus[type]);
    }
});

export { MenuModel };
