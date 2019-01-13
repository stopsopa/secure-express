u: # push to github & release in heroku
	@/bin/bash update.sh

uf: # update even if there is nothing new committed
	@/bin/bash update.sh force
t:
	/bin/bash test.sh

nt: # test .npmignore
	@npm pack



