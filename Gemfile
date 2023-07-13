source "https://rubygems.org"
# Hello! This is where you manage which Jekyll version is used to run.
# When you want to use a different version, change it below, save the
# file and run `bundle install`. Run Jekyll with `bundle exec`, like so:
#
#     bundle exec jekyll serve
#     bundle exec jekyll serve --livereload
#     bundle exec jekyll serve --livereload --drafts
#     bundle exec jekyll serve --livereload --drafts --host 0.0.0.0 ([Accessing a Jekyll site over your local wifi network](https://zarino.co.uk/post/jekyll-local-network/))
#
# This will help ensure the proper Jekyll version is running.
# Happy Jekylling!
# gem "jekyll", "~> 4.2.1"
# This is the default theme for new Jekyll sites. You may change this to anything you like.
gem "minima", "~> 2.5"
# If you want to use GitHub Pages, remove the "gem "jekyll"" above and
# uncomment the line below. To upgrade, run `bundle update github-pages`.
gem "github-pages", group: :jekyll_plugins
# If you have any plugins, put them here!
group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.12"
end

# Windows and JRuby does not include zoneinfo files, so bundle the tzinfo-data gem
# and associated library.
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", "~> 1.2"
  gem "tzinfo-data"
end

# Performance-booster for watching directories on Windows
gem "wdm", "~> 0.1.1", :platforms => [:mingw, :x64_mingw, :mswin]

# TODO- The below is added in response to the following error after updating to ruby 3- `cannot load such file -- webrick (LoadError)`. Below is the workaround suggested in [Load error: cannot load such file – webrick](https://talk.jekyllrb.com/t/load-error-cannot-load-such-file-webrick/5417). Perform an audit to determine if this is necessary in the future.  
gem "webrick", "~> 1.8"
