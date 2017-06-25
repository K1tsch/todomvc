/*global jQuery, Handlebars, Router */
jQuery(function ($) {
	'use strict';

	Handlebars.registerHelper('eq', function (a, b, options) {
		return a === b ? options.fn(this) : options.inverse(this);
	});

	var ENTER_KEY = 13;		//回车键的代码
	var ESCAPE_KEY = 27;		//退出键的

	var util = {				//表达工具集
		uuid: function () {
			/*jshint bitwise:false */
			var i, random;
			var uuid = '';

			for (i = 0; i < 32; i++) {
				random = Math.random() * 16 | 0;		//浮点数会向下取整，&和|是按位运算符。一般用Math.floor...
				if (i === 8 || i === 12 || i === 16 || i === 20) {
					uuid += '-';
				}
				uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
			}

			return uuid;		//最后得到一个不重复的data-id
		},
		pluralize: function (count, word) {			//业务
			return count === 1 ? word : word + 's';		//如果是1直接返回1，1以上加s返回（因为业务里没有1以下的数）。1 item，2 items
		},
		store: function (namespace, data) {		//保存一个数值
			if (arguments.length > 1) {			//arguments：每个函数执行时调用它的参数，>1表示有参数
				return localStorage.setItem(namespace, JSON.stringify(data));			//localStorage数据存在浏览器，stringify数据格式成（json）格式，都是window下的
			} else {
				var store = localStorage.getItem(namespace);
				return (store && JSON.parse(store)) || [];
			}
		}
	};

	var App = {
		init: function () {
			this.todos = util.store('todos-jquery');		//存档	
			this.todoTemplate = Handlebars.compile($('#todo-template').html());		//handlebars.js里的
			this.footerTemplate = Handlebars.compile($('#footer-template').html());
			this.bindEvents();		

			new Router({			//决定all、active、completed点击后地址栏的后缀？看不懂的就忽略
				'/:filter': function (filter) {
					this.filter = filter;
					this.render();		//编译，等函数都执行了，集中的把数据画到页面上
				}.bind(this)
			}).init('/all');
		},
		bindEvents: function () {
			$('#new-todo').on('keyup', this.create.bind(this));			//选择器选new-todo在keyup事件会执行后面的函数
			//bind是系统自带的function方法，无论什么时候执行都是当时绑定的this
			//如果用原生js写就很麻烦document.getElementById()
			$('#toggle-all').on('change', this.toggleAll.bind(this));		
			$('#footer').on('click', '#clear-completed', this.destroyCompleted.bind(this));		
			//代理，大爷，clear-completed写在里面因为一开始还没有#clear-completed，一旦footer里有就执行
			$('#todo-list')
				.on('change', '.toggle', this.toggle.bind(this))
				.on('dblclick', 'label', this.edit.bind(this))		//
				.on('keyup', '.edit', this.editKeyup.bind(this))
				.on('focusout', '.edit', this.update.bind(this))
				.on('click', '.destroy', this.destroy.bind(this));
		},
		render: function () {
			var todos = this.getFilteredTodos();
			$('#todo-list').html(this.todoTemplate(todos));		//用一些变量渲染了模版，替换并塞到了html里面，数据与样式分离的思想
			$('#main').toggle(todos.length > 0);
			$('#toggle-all').prop('checked', this.getActiveTodos().length === 0);
			this.renderFooter();
			$('#new-todo').focus();
			util.store('todos-jquery', this.todos);
		},
		renderFooter: function () {
			var todoCount = this.todos.length;
			var activeTodoCount = this.getActiveTodos().length;
			var template = this.footerTemplate({
				activeTodoCount: activeTodoCount,
				activeTodoWord: util.pluralize(activeTodoCount, 'item'),
				completedTodos: todoCount - activeTodoCount,
				filter: this.filter
			});

			$('#footer').toggle(todoCount > 0).html(template);
		},
		toggleAll: function (e) {
			var isChecked = $(e.target).prop('checked');

			this.todos.forEach(function (todo) {
				todo.completed = isChecked;
			});

			this.render();
		},
		getActiveTodos: function () {
			return this.todos.filter(function (todo) {
				return !todo.completed;
			});
		},
		getCompletedTodos: function () {
			return this.todos.filter(function (todo) {
				return todo.completed;
			});
		},
		getFilteredTodos: function () {
			if (this.filter === 'active') {
				return this.getActiveTodos();
			}

			if (this.filter === 'completed') {
				return this.getCompletedTodos();
			}

			return this.todos;		//返回Line43的数据
		},
		destroyCompleted: function () {
			this.todos = this.getActiveTodos();
			this.filter = 'all';
			this.render();
		},
		// accepts an element from inside the `.item` div and
		// returns the corresponding index in the `todos` array
		indexFromEl: function (el) {
			var id = $(el).closest('li').data('id');
			var todos = this.todos;
			var i = todos.length;

			while (i--) {
				if (todos[i].id === id) {
					return i;
				}
			}
		},
		create: function (e) {
			var $input = $(e.target);
			var val = $input.val().trim();

			if (e.which !== ENTER_KEY || !val) {
				return;
			}

			this.todos.push({
				id: util.uuid(),
				title: val,
				completed: false
			});

			$input.val('');

			this.render();
		},
		toggle: function (e) {
			var i = this.indexFromEl(e.target);
			this.todos[i].completed = !this.todos[i].completed;
			this.render();
		},
		edit: function (e) {
			var $input = $(e.target).closest('li').addClass('editing').find('.edit');
			//$后面有()说明是函数(在jquery.js里定义了，加上了jQuery的方法)，返回值是jQuery对象，有closest方法，closest返回值是个对象，在上面添加editing的class，addClass返回值也是对象，并找.edit。所以可以一直xx.xx.xxx。功能：双击可编辑
			//e是event,e.target触发这个事件的，去找最近的li，然后addClass…,通过css样式edit来控制显不显示，display:none

			$input.focus();		//聚焦
		},
		editKeyup: function (e) {
			if (e.which === ENTER_KEY) {
				e.target.blur();
			}

			if (e.which === ESCAPE_KEY) {
				$(e.target).data('abort', true).blur();
			}
		},
		update: function (e) {
			var el = e.target;
			var $el = $(el);
			var val = $el.val().trim();

			if (!val) {
				this.destroy(e);
				return;
			}

			if ($el.data('abort')) {
				$el.data('abort', false);
			} else {
				this.todos[this.indexFromEl(el)].title = val;
			}

			this.render();
		},
		destroy: function (e) {
			this.todos.splice(this.indexFromEl(e.target), 1);
			this.render();
		}
	};

	App.init();
});
